export interface Profile {
    name: string,
    branches: Branch[],
}

export interface Branch {
    name: string,
    directory: string,
}