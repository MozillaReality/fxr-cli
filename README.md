# `fxr` – CLI tool for Firefox Reality

A command-line tool for installing and automating [Firefox Reality](https://github.com/MozillaReality/FirefoxReality).


## Usage

```sh
npm install -g fxr
fxr
```


## Commands

To get a list of all commands and options:

```sh
fxr --help
```

#### `fxr launch <url> [options]`

To launch a URL in Firefox Reality:

```sh
fxr launch http://example.com/
```


## CLI development

To work on improving the `fxr` CLI in this repository, first ensure you've set up the project and installed the dependencies:

1. Clone this git repository, and open the directory created:

    ```sh
    git clone git@github.com:MozillaReality/fxr-cli.git
    cd fxr-cli
    ```

2. Install the [Node](https://nodejs.org/en/download/) dependencies:

    ```sh
    npm install
    ```

3. Run the CLI:

    ```sh
    node index.js
    ```


## Maintaining this project

To freeze `master` at a new version, run these commands:

```sh
npm run publish
```

## License

```
Copyright 2018 Mozilla Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
