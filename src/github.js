const fs = require('fs');
const path = require('path');
const octokit = require('@octokit/rest')();

const logger = require('./logger');

exports.uploadToGithub = async (alias, metadata, tmpPath) => {
  octokit.authenticate({
    type: 'token',
    token: process.env.GITHUB_TOKEN,
  });

  const b64 = fs.readFileSync(tmpPath, { encoding: 'base64' });

  // allows full url or just owner/repo
  const [repo, owner] = process.env.GITHUB_REPO.split('/').reverse();
  const branch = process.env.GITHUB_REPO_BRANCH;
  const emojiRepoDir = process.env.GITHUB_REPO_DIR;
  const emojiPath = path.join(
    emojiRepoDir,
    `${alias}.${metadata.file.filetype}`
  );

  try {
    await octokit.repos.createFile({
      owner,
      repo,
      path: emojiPath,
      branch,
      message: `emojo: added :${alias}:`,
      content: b64,
    });

    logger.info(
      `Created ${alias}.${metadata.file.filetype} in ${owner}/${repo}`
    );
  } catch (e) {
    logger.error(
      `Error creating file on Github ${owner}/${repo}/${emojiPath}`,
      e
    );
    // @todo: this needs handling as a proper response
  }
};
