// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const git = require('simple-git')

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	let {configPath, gitloaderPath, gitloaderParent} = setup()

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "gitloader" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let save = vscode.commands.registerCommand('extension.save', async () => {
		// The code you place here will be executed every time your command is executed
		const input = await vscode.window.showInputBox({
			value: 'configurationName',
			valueSelection: [0, 17],
		});

		if (!input) {
			vscode.window.showErrorMessage('No name provided, nothing was saved.');
			return;
		}

		let gitloaderChild = {
			configName: input,
			branches:[],
		}

		// grab the branch name from each directory and save branchName and dirName
		for(const dir of getDirectories(configPath)) {
			await git(path.join(configPath, dir)).raw([
				'rev-parse', '--abbrev-ref', 'HEAD'
				], (err, result) => {
					if (err) {
						throw err;
					}
					if (result) {
						gitloaderChild.branches.push({
							dirName: dir,
							branchName: result.replace('\n', ''),
						})
					}
				}
			)
		}

		// if the config name exists, replace it
		let index = gitloaderParent.profiles.findIndex(obj => obj.configName == input)
		if (index < 0) {
			gitloaderParent.profiles.push(gitloaderChild);
		} else {
			gitloaderParent.profiles[index] = gitloaderChild
		}

		fs.writeFileSync(gitloaderPath, JSON.stringify(gitloaderParent))

		// Display a message box to the user
		vscode.window.showInformationMessage(`Current branch config saved as ${input}!`);
	})

	let load = vscode.commands.registerCommand('extension.load', async () => {
		let profileStrings = [];
		for (const child of gitloaderParent.profiles) {
			profileStrings.push(child.configName)
		}
		const input = await vscode.window.showQuickPick(profileStrings)
		const currentConfig = gitloaderParent.profiles.find(obj => obj.configName == input)

		currentConfig.branches.forEach(async (branch) =>  {
			await git(path.join(configPath, branch.dirName)).raw([
				'checkout', branch.branchName
				], (err) => {
					if (err) {
						throw err;
					}
				}
			)
		})

		// Display a message box to the user
		vscode.window.showInformationMessage(`Config: ${input} loaded!`);
	})

	let del = vscode.commands.registerCommand('extension.delete', async () => {
		let profileStrings = [];
		for (const child of gitloaderParent.profiles) {
			profileStrings.push(child.configName)
		}
		const input = await vscode.window.showQuickPick(profileStrings)
		let index = gitloaderParent.profiles.findIndex(obj => obj.configName == input)
		gitloaderParent.profiles.splice(index, 1)

		fs.writeFileSync(gitloaderPath, JSON.stringify(gitloaderParent))

		// Display a message box to the user
		vscode.window.showInformationMessage(`Config: ${input} deleted!`);
	})

	context.subscriptions.push(save);
	context.subscriptions.push(load);
	context.subscriptions.push(del);
}

// this method is called when your extension is deactivated
function deactivate() { }

function setup() {
	let configPath;
	let gitloaderParent;

	if (vscode.workspace.workspaceFolders) {
		configPath = removeLastDirectoryPartOf(vscode.workspace.workspaceFolders[0].uri.fsPath);
	} else {
		configPath = __dirname;
	}
	const gitloaderPath = path.join(configPath, 'gitloader.json')
	console.log(`Looking for gitloader.json in ${configPath}`)
	try {
		fs.accessSync(gitloaderPath)
	} catch (error) {
		gitloaderParent = {
			profiles: [],
		}
		fs.writeFileSync(gitloaderPath, JSON.stringify(gitloaderParent))
	}	

	gitloaderParent = JSON.parse(fs.readFileSync(gitloaderPath))

	return {configPath, gitloaderPath, gitloaderParent};
}

function getDirectories(source) {
	return fs.readdirSync(source, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);
}

function removeLastDirectoryPartOf(path)
{
    var temp = path.split('/');
    temp.pop();
    return(temp.join('/'));
}

module.exports = {
	activate,
	deactivate
}
