const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const git = require('simple-git')

/**
 * Serves as the outer JSON object for gitloader.json.
 * Will create or load a previous gitloader.json.
 */
class Parent {
	constructor() {
		this.profiles = []
		let configPath

		if (vscode.workspace.workspaceFolders) {
			let workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath
			configPath = removeLastDirectoryPartOf(workspacePath)
			console.log(`Gitloader initialized using workspace path: ${workspacePath}`)
		} else {
			vscode.window.showErrorMessage('You must be in a workspace to use gitloader!')
		}
		const gitloaderPath = path.join(configPath, 'gitloader.json')
		console.log(`Looking for gitloader.json in ${configPath}`)
		try {
			// Touch the file. If it does not exist, will throw exception
			fs.accessSync(gitloaderPath)
			let previousParent = JSON.parse(fs.readFileSync(gitloaderPath))
			this.profiles = previousParent.profiles
			console.log(`Using gitloader.json in ${configPath}`)
		} catch (error) {
			fs.writeFileSync(gitloaderPath, toPrettyJson(this))
			console.log(`gitloader.json not found: creating one in ${configPath}`)
		}

		this.configPath = configPath
		this.gitloaderPath = gitloaderPath
	}
	/**
	 * Add a profile to profiles.
	 * @param {Profile} profile 
	 */
	addProfile(profile) {
		this.profiles.push(profile)
	}
	/**
	 * Returns true if a profile with configName already exists.
	 * @param {String} configName 
	 */
	doesProfileExist(configName) {
		let index = this.profiles.findIndex(obj => obj.configName == configName)
		if (index < 0) {
			return false
		} else {
			return true
		}
	}
	/**
	 * Returns the profile matching the configName.
	 * @param {String} configName 
	 */
	getProfile(configName) {
		return this.profiles.find(obj => obj.configName == configName)
	}
	/**
	 * Replaces the profile with the same config name as the passed profile.
	 * Throws an exception if the profile does not exist.
	 * @param {Profile} profile 
	 */
	replaceProfile(profile) {
		let index = this.profiles.findIndex(obj => obj.configName == profile.configName)
		if (index < 0) {
			throw "This profile cannot be replaced since it does not exist!"
		} else {
			this.profiles[index] = profile
		}
	}
	/**
	 * Deletes a profile with the same configName as configName.
	 * @param {string} configName
	 */
	deleteProfile(configName) {
		let index = this.profiles.findIndex(obj => obj.configName == configName)
		return this.profiles.splice(index, 1)[0]
	}
	/**
	 * Saves the current configuration as a new profile in gitloader.json.
	 */
	async save() {
		const input = await vscode.window.showInputBox({
			value: 'configurationName',
			valueSelection: [0, 17],
		})
	
		if (!input) {
			vscode.window.showErrorMessage('No name provided, nothing was saved.')
			return
		}
	
		const profile = new Profile(input)

		console.log(`Adding the following from config: ${input}`)
	
		// grab the branch name from each directory and save branchName and dirName
		for(const dir of vscode.workspace.workspaceFolders) {
			await git(dir.uri.fsPath).raw([
				'rev-parse', '--abbrev-ref', 'HEAD'
				], (err, result) => {
					if (err) {
						throw err
					}
					result = result.replace('\n', '')
					if (result && result != "master" && result != "develop") {
						const branch = new Branch(dir.name, result)
						profile.addBranch(branch)
						console.log(`${toPrettyJson(branch)}`)
					}
				}
			)
		}
	
		// if the config name exists, replace it
		// TODO: prompt the user if they are sure they want to replace first
		if (this.doesProfileExist(profile.configName)) {
			this.replaceProfile(profile)
			console.log(`Replacing profile: ${toPrettyJson(profile)}`)
		} else {
			this.addProfile(profile)
			console.log(`Creating profile: ${toPrettyJson(profile)}`)
		}
	
		fs.writeFileSync(this.gitloaderPath, toPrettyJson(this))
	
		vscode.window.showInformationMessage(`Current branch config saved as ${input}!`)
	}
	/**
	 * Load a saved profile from gitloader.json.
	 */
	async load() {
		let profileStrings = []
		for (const child of this.profiles) {
			profileStrings.push(child.configName)
		}
		const input = await vscode.window.showQuickPick(profileStrings)
		const currentConfig = this.getProfile(input)

		console.log(`Loading the following from config: ${input}`)

		// checkout to all the saved branches
		currentConfig.branches.forEach(async (branch) =>  {
			await git(path.join(this.configPath, branch.dirName)).raw([
				'checkout', branch.branchName
				], (err) => {
					if (err) {
						throw err
					}
					console.log(`${toPrettyJson(branch)}`)
				}
			)
		})
		vscode.window.showInformationMessage(`Config: ${input} loaded!`)
	}
	/**
	 * Delete a profile in gitloader.json.
	 */
	async delete () {
		let profileStrings = []
		for (const child of this.profiles) {
			profileStrings.push(child.configName)
		}
		const input = await vscode.window.showQuickPick(profileStrings)
		let deletedProfile = this.deleteProfile(input)
		fs.writeFileSync(this.gitloaderPath, toPrettyJson(this))

		console.log(`Deleting the following profile from config: ${input}`)
		console.log(toPrettyJson(deletedProfile))

		vscode.window.showInformationMessage(`Config: ${input} deleted!`)
	}
}

/**
 * Saves branch states under a configuration name.
 */
class Profile {
	constructor(configName) {
		this.configName = configName
		this.branches = []
	}
	addBranch(branch) {
		this.branches.push(branch)
	}
}

/**
 * Holds branch data like directory name and branch name.
 */
class Branch {
	constructor(dirName, branchName) {
		this.dirName = dirName
		this.branchName = branchName
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('Attempting to create/load gitloader.')
	const parent = new Parent();

	let save = vscode.commands.registerCommand('extension.save', parent.save.bind(parent))
	let load = vscode.commands.registerCommand('extension.load', parent.load.bind(parent))
	let del = vscode.commands.registerCommand('extension.delete', parent.delete.bind(parent))

	context.subscriptions.push(save)
	context.subscriptions.push(load)
	context.subscriptions.push(del)
}

function deactivate() { }

/**
 * Removes the last directory from a path string. 
 * Should handle both windows and unix paths.
 * @param {String} path 
 */
function removeLastDirectoryPartOf(path) {
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

/**
 * Turns an object into a formatted JSON string. 
 * @param {Object} o 
 */
function toPrettyJson(o) {
	return JSON.stringify(o, null, 2)
}

module.exports = {
	activate,
	deactivate
}
