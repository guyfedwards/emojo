# Emojo
Lambda function to be used as a slack app to add uploaded emoji to github repo to then be deployed to slack through CI.

### Config
All config is done through environment variables. These can be set in a `.env` file in the root of the project. See `.env.example`

#### `GITHUB_REPO`
Name of the repo you wish to save your emoji too

#### `GITHUB_REPO_DIR`
A sub-directory in the repo where the images themselves will be added.

#### `GITHUB_REPO_BRANCH`
Custom branch to commit the uploaded emoji to

### Deploy
Emojo is built using `serverless` so you can deploy with:
```
$ yarn deploy
```


### Development
You can start a local serverless server with
```
$ yarn dev
```
Then tunnel to localhost with ngrok:
```
$ ngrok http localhost:5020
```
This will give you a url you can use as the hook in Slack for the app.
