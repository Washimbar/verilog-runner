# Iotika Verilog Runner

One-click **Compile & Run** (`iverilog` + `vvp`) and **GTKWave** buttons in the editor title bar and status bar for Verilog (`.v`) files.

Developed by **Washim Bari** — **Iotika Technology Private Limited** ([iotika.in](https://iotika.in)).

## Features

- **▶ Compile & Run** button in the top-right editor title bar and bottom-left status bar (`▶ Run Verilog`) for any `.v` file.
- **Waveforms (`pulse` icon)** button in the editor title bar to compile, simulate, and automatically open the `.vcd` file in GTKWave.
- **Auto-pairs modules and testbenches** (`<name>.v` + `<name>_tb.v`, including `src/` and `src/testbench/` layouts).
- **New Module + Testbench** command (`Ctrl+Shift+P` → `Verilog Runner: New Module + Testbench`).

## Prerequisites

- [Icarus Verilog](https://bleyer.org/icarus/) (`iverilog` & `vvp`)
- [GTKWave](https://gtkwave.sourceforge.net/) (`gtkwave`, optional for waveform viewing)

## Install from `.vsix`

1. Download `iotika-verilog-runner-0.1.0.vsix` from Releases (or build it with `npx @vscode/vsce package`).
2. In VS Code / Antigravity IDE, open the Command Palette (`Ctrl+Shift+P`) → **Extensions: Install from VSIX...** and select the `.vsix` file.
3. Or install via CLI:
   ```powershell
   antigravity-ide --install-extension iotika-verilog-runner-0.1.0.vsix
   ```

