import simpleGit from 'simple-git';
import * as vscode from 'vscode';
import { Branch, Profile } from './types';

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('Attempting to create or load gitprofiles.');
	const workspacePath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";
	const workspaceFolders = vscode.workspace.workspaceFolders || [];
	const state = context.workspaceState;

	if (workspacePath === undefined) {
		vscode.window.showInformationMessage('gitprofiles is disabled: must be in a workspace with multiple directories');
		return;
	}

	if (state.get('gitprofiles') === undefined) {
		state.update('gitprofiles', [] as Profile[]);
	}

	console.log(`gitprofiles initialized using workspace path: ${workspacePath}`);

	const save = vscode.commands.registerCommand('extension.saveProfile', () => saveProfile(context.workspaceState, workspaceFolders));
	const load = vscode.commands.registerCommand('extension.loadProfile', () => loadProfile(context.workspaceState));
	const del = vscode.commands.registerCommand('extension.deleteProfile', () => deleteProfile(context.workspaceState));
	const run = vscode.commands.registerCommand('extension.runCommand', () => runCommand(workspaceFolders));

	context.subscriptions.push(save);
	context.subscriptions.push(load);
	context.subscriptions.push(del);
	context.subscriptions.push(run);
}

export function deactivate() { }

async function saveProfile(state: vscode.Memento, workspaceFolders: readonly vscode.WorkspaceFolder[]) {
	// get the new name of the profile from the user
	const input = await vscode.window.showInputBox({ value: 'configurationName' });

	if (!input) {
		vscode.window.showErrorMessage('No gitprofile name provided: nothing was saved.');
		return;
	}
	console.log(`Attempting to save new gitprofile as: ${input}`);

	// get profiles from storage
	const profiles = state.get('gitprofiles') as Profile[];
	const newProfile = { name: input, branches: [] as Branch[] } as Profile;

	// grab the branch name from each directory and save branchName and dirName
	for (const dir of workspaceFolders) {
		await simpleGit(dir.uri.fsPath).raw([
			'rev-parse', '--abbrev-ref', 'HEAD'
		], (e, branchName) => {
			if (e) {
				throw e;
			}
			branchName = branchName.replace('\n', '');
			if (branchName) {
				newProfile.branches.push({ name: branchName, directory: dir.uri.fsPath });
			}
		});
	}

	// if they specify an existing profile name, prompt them again
	if (profiles.includes(newProfile)) {
		const yesorno = await vscode.window.showQuickPick(['yes', 'no'], { title: "Are you sure? This will overwrite another profile." });

		if (yesorno !== 'yes') { return; }

		console.log(`Replacing profile: ${toPrettyJson(newProfile)}`);
		const replacementIndex = profiles.findIndex(p => p.name === newProfile.name);
		profiles[replacementIndex] = newProfile;
	} else {
		console.log(`Creating profile: ${toPrettyJson(newProfile)}`);
		profiles.push(newProfile);
	}

	// update storage
	state.update('gitprofiles', profiles);
	vscode.window.showInformationMessage(`Current gitprofile saved as ${input}!`);
}

async function loadProfile(state: vscode.Memento) {
	const profiles = state.get('gitprofiles') as Profile[];

	// get which profile to load from the user
	const input = await vscode.window.showQuickPick(profiles.map(p => p.name));
	const profileToLoad = profiles.find(p => p.name === input);

	if (profileToLoad === undefined) {
		vscode.window.showErrorMessage('No gitprofile name provided: nothing was loaded.');
		return;
	}

	console.log(`Loading the following from gitprofile: ${input}`);

	// checkout to all the saved branches
	for (const branch of profileToLoad.branches) {
		await simpleGit(branch.directory).raw([
			'checkout', branch.name
		], (err) => {
			if (err) {
				throw err;
			}
		});
	}
	vscode.window.showInformationMessage(`gitprofile: ${input} loaded!`);
}

async function deleteProfile(state: vscode.Memento) {
	const profiles = state.get('gitprofiles') as Profile[];
	// show profile list, get one from user input
	const input = await vscode.window.showQuickPick(profiles.map(p => p.name));
	const profileToDelete = profiles.find(p => p.name === input);
	if (profileToDelete === undefined) {
		vscode.window.showErrorMessage('No gitprofile name provided: nothing was deleted.');
		return;
	}

	console.log(`Deleting the following gitprofile: ${input}`);
	console.log(toPrettyJson(profileToDelete));

	// update storage
	state.update('gitprofiles', profiles.filter(p => p.name !== profileToDelete.name));
	vscode.window.showInformationMessage(`gitprofile: ${input} deleted!`);
}

async function runCommand(workspaceFolders: readonly vscode.WorkspaceFolder[]) {
	// get the command to run
	const input = await vscode.window.showInputBox({ value: 'git checkout -b newBranch' });

	if (input === undefined) {
		vscode.window.showErrorMessage('No command provided.');
		return;
	}

	console.log(`Running command: ${input}`);
	const formattedInput = input.split(' ').filter(s => s !== 'git');
	// run the command
	for (const dir of workspaceFolders) {
		await simpleGit(dir.uri.fsPath).raw(formattedInput, (err) => {
			if (err) {
				vscode.window.showErrorMessage(`${dir.uri.fsPath}: ${err}`);
			}
		}).catch(() => null);
	}

	vscode.window.showInformationMessage(`${input}: completed`);
}

/**
 * Turns an object into a formatted JSON string.
 * @param {Object} o
 */
function toPrettyJson(o: object) {
	return JSON.stringify(o, null, 2);
}
