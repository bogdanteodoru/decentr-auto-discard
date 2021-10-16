# Decentr Auto-Discard POC extension

#### How to install on your computer
- Download the zip file
- Unzip to a location where you won't delete the files ;)
- Go to `decentr://extensions/` in your browser
- Activate `developer mode` if its not already active (top right hand side)
- Click `Load unpacked` and select the folder where you've unzipped the extension
- Enjoy and report bugs if any

#### How to build

- Check if NodeJs is installed (I personally used version `v14.17.4` to work on this)
- `npm install`
- `npm run start` to build the project with watching functionality
- `npm run build:production` to build the project for production (will output a ZIP file)
