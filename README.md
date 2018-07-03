# `fxr` – CLI tool for Firefox Reality

A command-line tool for installing and automating the [Firefox Reality][firefox-reality] virtual-reality browser.

## Usage

On your PC machine, first ensure [Node.js](https://nodejs.org/en/download/) is installed.

To install the `fxr` tool on your machine, run this in your command-line terminal (e.g., _Terminal_ in `Applications > Utilities` on macOS):

```sh
npm install -g fxr
fxr
```




## First-time experience for the _Oculus Go_ VR headset

1. Ensure your headset has the Oculus mobile-companion app installed. Go to **https://www.oculus.com/setup/** from your [iOS](https://itunes.apple.com/us/app/oculus-vr/id1366478176) or [Android](https://play.google.com/store/apps/details?id=com.oculus.twilight) device.
2. Enable [`Developer Mode`](https://developer.oculus.com/documentation/mobilesdk/latest/concepts/mobile-device-setup-go/) in the Oculus mobile-companion app: `Settings > Oculus Go (• Connected) > More Settings > Developer Mode > Developer mode`
3. On your PC machine, ensure [Node.js](https://nodejs.org/en/download/) is installed.
4. Run this in your command-line terminal (e.g., _Terminal_ in `Applications > Utilities` on macOS):

    ```sh
    npm install -g fxr
    ```

5. To download (but not yet install) the latest version of the [Firefox Reality][firefox-reality] browser:

    ```sh
    fxr download
    ```

6. Now that we have the latest version downloaded, we can install the [Firefox Reality][firefox-reality] browser on the VR headset.

    💡 **TIP:** Put your finger in front of the proximity sensor on the Oculus Go headset. Then, press the volume-left (top-left) button to enter `Developer Mode`.

    Run this command in your terminal:

    ```sh
    fxr install
    ```

7. To launch a URL in the browser, run this command in your terminal:

    ```sh
    fxr launch http://example.com/
    ```


## Commands

To display a list of all commands and options:

```sh
fxr --help
```

#### `fxr launch <url> [options]`

#### `fxr launch <url> [options]`

To launch Firefox Reality:

```sh
fxr launch
```

To launch a URL (e.g., http://example.com/) in Firefox Reality:

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

2. Install the [Node.js](https://nodejs.org/en/download/) dependencies:

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

[firefox-reality]: https://github.com/MozillaReality/FirefoxReality
