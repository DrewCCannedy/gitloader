import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
/**
 * Removes the last directory from a path string. 
 * Should handle both windows and unix paths.
 * @param {String} path 
 */
function removeLastDirectoryPartOf(path: String) {
	let splitPath = path.split('\\')
	// if not windows path
	if (splitPath[0].length == path.length) {
		splitPath = path.split('/')
		splitPath.pop()
		return(splitPath.join('/'))
	} else {
		splitPath.pop()
		return(splitPath.join('\\'))
	}    
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const workspacePath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	if (workspacePath === undefined) {
		vscode.window.showErrorMessage('You must be in a workspace to use gitloader!');
		return;
	} else {
		console.log(`Gitloader initialized using workspace path: ${workspacePath}`);
	}
	const configPath = removeLastDirectoryPartOf(workspacePath);	
	const gitloaderPath = path.join(configPath, 'gitloader.json');
	console.log(`Looking for gitloader.json in ${configPath}`);
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('gitloader.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Gitloader!');
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
