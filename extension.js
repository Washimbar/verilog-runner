const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

let runnerTerminal = null;

function getOrCreateTerminal(cwd) {
  if (runnerTerminal && runnerTerminal.exitStatus === undefined) {
    return runnerTerminal;
  }
  const env = {};
  if (process.platform === "win32") {
    const extra = ["C:\\iverilog\\bin", "C:\\iverilog\\gtkwave\\bin"].filter((d) =>
      fs.existsSync(d)
    );
    if (extra.length > 0) {
      env.PATH = `${process.env.PATH || ""};${extra.join(";")}`;
    }
  }
  runnerTerminal = vscode.window.createTerminal({
    name: "Iotika Verilog Runner",
    cwd,
    env,
  });
  return runnerTerminal;
}

function resolveVerilogSources(filePath, cwd) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const isTestbench = baseName.endsWith("_tb");
  const moduleName = isTestbench ? baseName.slice(0, -3) : baseName;

  const candidates = [
    path.join(cwd, "src", `${moduleName}.v`),
    path.join(cwd, `${moduleName}.v`),
    path.join(path.dirname(filePath), `${moduleName}.v`),
    path.join(cwd, "src", "testbench", `${moduleName}_tb.v`),
    path.join(cwd, "testbench", `${moduleName}_tb.v`),
    path.join(cwd, `${moduleName}_tb.v`),
    path.join(path.dirname(filePath), `${moduleName}_tb.v`),
  ];

  const sources = [];
  for (const c of candidates) {
    const norm = path.normalize(c);
    if (fs.existsSync(norm) && !sources.includes(norm)) {
      sources.push(norm);
    }
  }

  const normActive = path.normalize(filePath);
  if (!sources.includes(normActive)) {
    sources.push(normActive);
  }

  return { moduleName, sources };
}

function quoteArg(p) {
  return `"${p.replace(/"/g, '\\"')}"`;
}

async function runActiveVerilog(withWave) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Open a Verilog (.v) file first.");
    return;
  }

  const doc = editor.document;
  if (path.extname(doc.fileName).toLowerCase() !== ".v") {
    vscode.window.showWarningMessage("Active file is not a Verilog (.v) file.");
    return;
  }

  if (doc.isDirty) {
    await doc.save();
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
  const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(doc.fileName);
  const { moduleName, sources } = resolveVerilogSources(doc.fileName, cwd);

  const buildDir = path.join(cwd, "build");
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const vvpOut = path.join(buildDir, `${moduleName}.vvp`);
  const srcArgs = sources.map(quoteArg).join(" ");

  const terminal = getOrCreateTerminal(cwd);
  terminal.show(true);

  const isWin = process.platform === "win32";
  if (isWin) {
    let cmd = `iverilog -o ${quoteArg(vvpOut)} ${srcArgs}; if ($LASTEXITCODE -eq 0) { vvp ${quoteArg(vvpOut)}`;
    if (withWave) {
      const vcdRoot = path.join(cwd, `${moduleName}.vcd`);
      const vcdBuild = path.join(buildDir, `${moduleName}.vcd`);
      cmd += `; if ($LASTEXITCODE -eq 0) { if (Test-Path ${quoteArg(vcdRoot)}) { Start-Process gtkwave ${quoteArg(vcdRoot)} } elseif (Test-Path ${quoteArg(vcdBuild)}) { Start-Process gtkwave ${quoteArg(vcdBuild)} } else { Write-Warning "No .vcd file found for ${moduleName}. Add \`$dumpfile and \`$dumpvars to your testbench." } }`;
    }
    cmd += " }";
    terminal.sendText(cmd);
  } else {
    let cmd = `iverilog -o ${quoteArg(vvpOut)} ${srcArgs} && vvp ${quoteArg(vvpOut)}`;
    if (withWave) {
      const vcdRoot = path.join(cwd, `${moduleName}.vcd`);
      const vcdBuild = path.join(buildDir, `${moduleName}.vcd`);
      cmd += ` && ( [ -f ${quoteArg(vcdRoot)} ] && gtkwave ${quoteArg(vcdRoot)} & || [ -f ${quoteArg(vcdBuild)} ] && gtkwave ${quoteArg(vcdBuild)} & || echo "No .vcd file found for ${moduleName}" )`;
    }
    terminal.sendText(cmd);
  }
}

async function createNewModule() {
  const name = await vscode.window.showInputBox({
    prompt: "Enter the new Verilog module name (e.g., or_gate, full_adder)",
    validateInput: (val) =>
      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val.trim())
        ? null
        : "Use letters, digits, and underscores only (must start with a letter or _).",
  });

  if (!name) return;

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return;
  }

  const cwd = folders[0].uri.fsPath;
  const cleanName = name.trim();
  const hasSrc = fs.existsSync(path.join(cwd, "src"));
  const modDir = hasSrc ? path.join(cwd, "src") : cwd;
  const tbDir = hasSrc ? path.join(cwd, "src", "testbench") : cwd;

  fs.mkdirSync(modDir, { recursive: true });
  fs.mkdirSync(tbDir, { recursive: true });

  const modPath = path.join(modDir, `${cleanName}.v`);
  const tbPath = path.join(tbDir, `${cleanName}_tb.v`);

  if (fs.existsSync(modPath) || fs.existsSync(tbPath)) {
    vscode.window.showErrorMessage(`Already exists: ${modPath} or ${tbPath}`);
    return;
  }

  const modContent = `module ${cleanName}(
    input wire a,
    input wire b,
    output wire result
);

assign result = a & b;

endmodule
`;

  const tbContent = `module ${cleanName}_tb;

reg a;
reg b;
wire result;

${cleanName} uut(
    .a(a),
    .b(b),
    .result(result)
);

initial begin
    $dumpfile("${cleanName}.vcd");
    $dumpvars(0, ${cleanName}_tb);

    a = 0; b = 0; #10;
    $display("A=%b B=%b RESULT=%b", a, b, result);

    a = 0; b = 1; #10;
    $display("A=%b B=%b RESULT=%b", a, b, result);

    a = 1; b = 0; #10;
    $display("A=%b B=%b RESULT=%b", a, b, result);

    a = 1; b = 1; #10;
    $display("A=%b B=%b RESULT=%b", a, b, result);

    $finish;
end

endmodule
`;

  fs.writeFileSync(modPath, modContent, "utf8");
  fs.writeFileSync(tbPath, tbContent, "utf8");

  const doc = await vscode.workspace.openTextDocument(modPath);
  await vscode.window.showTextDocument(doc);
  vscode.window.showInformationMessage(`Created ${cleanName}.v and ${cleanName}_tb.v`);
}

function activate(context) {
  const statusBarRun = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarRun.command = "verilogRunner.run";
  statusBarRun.text = "$(play) Run Verilog";
  statusBarRun.tooltip = "Compile and run active Verilog file (iverilog + vvp)";

  const updateStatusBar = () => {
    const editor = vscode.window.activeTextEditor;
    const isVerilog =
      editor && path.extname(editor.document.fileName).toLowerCase() === ".v";
    if (isVerilog) {
      statusBarRun.show();
    } else {
      statusBarRun.hide();
    }
  };

  updateStatusBar();

  context.subscriptions.push(
    statusBarRun,
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
    vscode.commands.registerCommand("verilogRunner.run", () =>
      runActiveVerilog(false)
    ),
    vscode.commands.registerCommand("verilogRunner.runWave", () =>
      runActiveVerilog(true)
    ),
    vscode.commands.registerCommand("verilogRunner.newModule", createNewModule)
  );
}

function deactivate() {}

module.exports = { activate, deactivate };

