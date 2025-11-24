import * as vscode from 'vscode';
import { SRecordDocument } from './srecDoc'
import { calcSrecChecksum, getLineChecksum } from './crc';

export function activate(context: vscode.ExtensionContext) {
    let srecDoc = new SRecordDocument();
    let controller = new SRecordDocumentController(srecDoc);

    var findDisposable = vscode.commands.registerCommand('SRecord.Find', () => {
        if (vscode.window.activeTextEditor.document.languageId != "s19") {
            vscode.window.showErrorMessage("This command is only available with \".s19\" files.");
            return;
        }

        vscode.window.showInputBox({ prompt: 'Type an address to find (start with 0x)' }).then(val => {
            let address = parseInt(val);
            if (Number.isNaN(address) || address < 0) {
                vscode.window.showErrorMessage("Wrong address format.");
                return;
            }

            if (!srecDoc.goToAddress(address)) {
                vscode.window.showWarningMessage("The address 0x" + address.toString(16) + " was not found.")
            }
        });
    });

    var repairDisposable = vscode.commands.registerCommand('SRecord.Repair', () => {
        if(vscode.window.activeTextEditor.document.languageId != "s19")
        {
            vscode.window.showErrorMessage("This command is only available with \".hex\" files.");
            return;
        }

        let nbRep = srecDoc.repair();
        if(nbRep > 0) {
            vscode.window.showInformationMessage((nbRep === 1) ? "1 record has been repaired." : nbRep + " records have been repaired");
        } else {
            vscode.window.showInformationMessage("Nothing has been done.");
        }
    });
    const collection = vscode.languages.createDiagnosticCollection('srecord');
    context.subscriptions.push(collection);

    // CRC错误的两位字符装饰类型，优先用主题色，用户可通过配置项切换回退色
    let crcDecorationType: vscode.TextEditorDecorationType | undefined;
    function createCrcDecorationType() {
        const config = vscode.workspace.getConfiguration('srecord');
        const fallback = config.get('crcColorFallback', false);
        if (fallback) {
            const customColor = config.get('crcCustomColor', '#ff1744');
            return vscode.window.createTextEditorDecorationType({
                color: customColor,
                fontWeight: 'bold',
            });
        } else {
            return vscode.window.createTextEditorDecorationType({
                color: new vscode.ThemeColor('editorError.foreground'),
                fontWeight: 'bold',
            });
        }
    }

    function updateDiagnostics(document: vscode.TextDocument) {
        if (document.languageId !== 's19') return;
        // 每次都重建装饰类型，确保配置变更立即生效
        if (crcDecorationType) {
            crcDecorationType.dispose();
        }
        crcDecorationType = createCrcDecorationType();
        const diagnostics: vscode.Diagnostic[] = [];
        const crcRanges: vscode.Range[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            const expected = calcSrecChecksum(line);
            const actual = getLineChecksum(line);
            if (expected !== null && actual !== null && expected !== actual) {
                const range = new vscode.Range(i, 0, i, line.length);
                const message = `CRC 校验错误，应为 ${expected.toString(16).toUpperCase().padStart(2, '0')}`;
                diagnostics.push(new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error));
                // 高亮最后两位（CRC）
                if (line.length >= 2) {
                    crcRanges.push(new vscode.Range(i, line.length - 2, i, line.length));
                }
            }
        }
        collection.set(document.uri, diagnostics);
        // 设置装饰
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor && crcDecorationType) {
            editor.setDecorations(crcDecorationType, crcRanges);
        }
    }

    context.subscriptions.push(srecDoc);
    context.subscriptions.push(controller);
    context.subscriptions.push(findDisposable);
    context.subscriptions.push(repairDisposable);

    context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
    vscode.workspace.onDidChangeTextDocument(e => updateDiagnostics(e.document)),
    vscode.workspace.onDidSaveTextDocument(updateDiagnostics)
    );

    if (vscode.window.activeTextEditor) {
        updateDiagnostics(vscode.window.activeTextEditor.document);
    }
}

export function deactivate() {
}


class SRecordDocumentController {
    private _srecDoc: SRecordDocument;
    private _disposable: vscode.Disposable;

    constructor(srecDoc: SRecordDocument) {
        this._srecDoc = srecDoc;
        this._srecDoc.updateStatusBar();

        let subscriptions: vscode.Disposable[] = [];
        vscode.window.onDidChangeActiveTextEditor(this._onEdit, this, subscriptions);
        vscode.window.onDidChangeTextEditorSelection(this._onEdit, this, subscriptions);
        vscode.workspace.onDidSaveTextDocument(this._onSave, this, subscriptions);

        this._disposable = vscode.Disposable.from(...subscriptions);
    }

    dispose() {
        this._disposable.dispose();
    }

    private _onEdit() {
        this._srecDoc.updateStatusBar();
    }

    private _onSave() {
        if (vscode.window.activeTextEditor.document.languageId === "s19" &&
            vscode.workspace.getConfiguration("srecord").get("repairOnSave", false)) {
            if (this._srecDoc.repair() > 0) {
                vscode.window.activeTextEditor.document.save();
            }
        }
    }
}