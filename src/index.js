/*
Copyright (c) 2017 Holvonix LLC and the pullmaster AUTHORS

Portions from github-auto-assign-reviewers-cloud-functions:
  Copyright 2017, Google Cloud Platform Community Authors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
/* eslint-disable */
// @flow

const crypto = require("crypto");
const got = require("got");
const url = require("url");
const yaml = require("js-yaml");

const defaultSettings = {
  user: "#non-existent-example-bot",
  secretToken: "WebHook shared secret",
  accessToken: "OAUTH access token",
  reviewers: [""],
  // people who can issue commands via comments
  admins: [""],
  spewStack: false,
  // add comments showing what the bot does
  useComments: false
};

function handle(settingsNew: any, req: any, res: any) {
  var settings = Object.assign({}, defaultSettings, settingsNew);

  const action = req.body.action;
  const event = req.headers["x-github-event"];

  var func;

  if (event === "pull_request") {
    if (action === "opened") {
      func = handlePullRequestOpened;
    }
  } else if (event === "issue_comment" && "pull_request" in req.body.issue) {
    if (action === "created") {
      func = handlePullRequestCommentCreated;
    }
  } else if (
    event === "commit_comment" &&
    req.body.comment.user.login === settings.user
  ) {
    if (action === "created") {
      func = handleCommitCommentCreated;
    }
  } else if (event === "pull_request_review") {
    if (action === "submitted" || action === "edited") {
      func = handlePullRequestReviewed;
    }
  }

  if (func != null) {
    const f = func;
    return validateRequest(settings, req)
      .then(() => f(settings, req, res))
      .then(() => {
        res.status(200).end();
      })
      .catch(err => {
        handleResponseThrow(settings, err, req, res);
      });
  }

  // Ignore it!
  res.end();
  return;
}

/**
 * Assigns a reviewer to a new pull request from a list of eligble reviewers.
 * Reviewers with the least assigned reviews on open pull requests will be
 * prioritized for assignment.
 */
function handlePullRequestOpened(settings: any, req: any, res: any) {
  const pullRequest = req.body.pull_request;
  console.log(`New PR: ${pullRequest.title} by ${pullRequest.user.login}`);
  return getPullRequests(settings, pullRequest.base.repo)
    .then(pullRequests => getNextReviewer(settings, pullRequest, pullRequests))
    .then(nextReviewer => assignReviewer(settings, nextReviewer, pullRequest));
}

/**
 * Handles commands issues via a pull request comment.
 */
function handlePullRequestCommentCreated(settings: any, req: any, res: any) {
  const pullRequest = req.body.issue.pull_request;
  const requestor = req.body.comment.user.login || "";
  const content = req.body.comment.body || "";
  const commentPostUrl = req.body.issue.comments_url;
  console.log(`Comment on PR: ${pullRequest.url} commented by ${requestor}`);
  return handlePullRequestCommands(
    settings,
    req,
    res,
    pullRequest,
    requestor,
    content,
    commentPostUrl,
    req.body.comment.html_url
  );
}

/**
 * Handles commands issues via a pull request review.
 */
function handlePullRequestReviewed(settings: any, req: any, res: any) {
  const pullRequest = req.body.pull_request;
  const requestor = req.body.review.user.login || "";
  const content = req.body.review.body || "";
  const commentPostUrl = pullRequest.comments_url;
  console.log(`Review on PR: ${pullRequest.url} reviewed by ${requestor}`);
  return handlePullRequestCommands(
    settings,
    req,
    res,
    pullRequest,
    requestor,
    content,
    commentPostUrl,
    req.body.review.html_url
  );
}

function handlePullRequestCommands(
  settings: any,
  req: any,
  res: any,
  pullRequest: any,
  requestor: string,
  content: string,
  commentPostUrl: string,
  approvalUrl: string
) {
  // Validate the request
  if (!settings.admins.includes(requestor)) {
    // Ignore commands from non-admins
    const error: any = new Error(`${requestor} is not an admin`);
    error.statusCode = 202;
    throw error;
  }
  console.log(`Is admin: ${requestor}`);

  if (content.match(/(^|\s)#shipitnow($|\b)/gim)) {
    return handleShipItNow(
      settings,
      req,
      res,
      pullRequest,
      requestor,
      content,
      commentPostUrl,
      approvalUrl
    );
  } else if (content.match(/(^|\s)#shipit($|\b)/gim)) {
    return handleDeferShipIt(
      settings,
      req,
      res,
      pullRequest,
      requestor,
      content,
      commentPostUrl,
      approvalUrl
    );
  }

  // Ignore anything that is not a known command
  const error: any = new Error(`No known command in body.`);
  error.statusCode = 202;
  throw error;
}

function handleShipItNow(
  settings: any,
  req: any,
  res: any,
  pullRequest: any,
  requestor: string,
  content: string,
  commentPostUrl: string,
  approvalUrl: string
) {
  const postIt = () => {
    const prData = pullRequest.head
      ? Promise.resolve(pullRequest)
      : makeRequest(settings, pullRequest.url);
    return prData.then(pr => {
      console.log(`Got PR info: ${pr.html_url}`);
      return doMerge(settings, requestor, pr, approvalUrl);
    });
  };
  if (settings.useComments) {
    console.log(`Sent comment.`);
    return makeRequest(settings, commentPostUrl, {
      body: {
        body: `[cmd] \uD83D\uDEA2 \uD83D\uDCA8 ok @${requestor}, merging immediately\n\nsee ${approvalUrl}`
      }
    }).then(postIt);
  }
  return postIt();
}

// comment.commit_id,body,user.login, repository.pulls_url

function handleCommitCommentCreated(settings: any, req: any, res: any) {
  const pullRequest = req.body.pull_request;
  const requestor = req.body.review.user.login;
  const content = req.body.comment.body || "";
  const theSha = req.body.comment.commit_id;
  const pullsUrl = req.body.repository.pulls_url;
  const commentPostUrl = pullRequest.comments_url;

  const prefix = "* pullmaster-1-shipit:\n```yaml\n";
  const suffix = "\n```";

  return Promise.resolve(0)
    .then(() => {
      if (content.startsWith(prefix) && content.endsWith(suffix)) {
        const yamlBody = content.substr(
          prefix.length,
          content.length - prefix.length - suffix.length
        );
        const msg = yaml.safeLoad(yamlBody);
        const meta = {
          pr: msg.pr,
          url: msg.url,
          shipit: msg.shipit,
          requestor: msg.requestor,
          bot: msg.bot,
          commit: msg.commit,
          digest: msg.digest
        };
        const sealThis = [
          meta.pr,
          meta.url,
          meta.shipit,
          meta.requestor,
          meta.bot,
          meta.commit
        ];
        const digest = crypto
          .createHmac("sha256", settings.metadataSealSecretToken)
          .update(JSON.stringify(sealThis))
          .digest("hex");
        if (
          digest &&
          digest === meta.digest &&
          meta.bot === settings.user &&
          meta.commit === theSha &&
          meta.url == pullsUrl.replace("{/number}", `/${meta.pr}`)
        ) {
          console.log(`Validated pullmaster meta`);
          return meta;
        }
        var err: any = new Error("Invalid pullmaster metadata");
        err.statusCode = 403;
        throw err;
      }
    })
    .catch(() => {
      // Hide errors before validating.
      var err: any = new Error("Invalid pullmaster metadata");
      err.statusCode = 202;
      throw err;
    })
    .then(m => {
      const meta = m || {};
      const prData = makeRequest(settings, meta.url);
      return prData
        .then(pr => {
          console.log(`Got PR info: ${pr.html_url}`);
          if (
            pr.mergeable_state !== "clean" ||
            pr.merged ||
            pr.state === "closed" ||
            pr.head.sha !== meta.commit
          ) {
            var err: any = new Error("PR not yet green");
            err.statusCode = 202;
            throw err;
          }
          if (settings.useComments) {
            console.log(`Sent comment.`);
            return makeRequest(settings, pr.comments_url, {
              body: {
                body: `[cmd] \uD83D\uDEA2 \u2705 hey @${requestor}, PR is green, merging now\n\nsee ${
                  meta.shipit
                }\nverification code: ${meta.digest}`
              }
            }).then(() => [pr, meta]);
          }
          return Promise.resolve([pr, meta]);
        })
        .then(z => {
          const pr = z[0];
          const meta = z[1];
          return doMerge(settings, meta.requestor, pr, meta.shipit, "shipit");
        });
    });
}

function handleDeferShipIt(
  settings: any,
  req: any,
  res: any,
  pullRequest: any,
  requestor: string,
  content: string,
  commentPostUrl: string,
  approvalUrl: string
) {
  const prData = pullRequest.head
    ? Promise.resolve(pullRequest)
    : makeRequest(settings, pullRequest.url);
  return prData
    .then(pr => {
      console.log(`Got PR info: ${pr.html_url}`);
      const sealThis = [
        pr.number,
        pr.url,
        approvalUrl,
        requestor,
        settings.user,
        pr.head.sha
      ];
      const digest = crypto
        .createHmac("sha256", settings.metadataSealSecretToken)
        .update(JSON.stringify(sealThis))
        .digest("hex");
      const meta = {
        pr: pr.number,
        url: pr.url,
        shipit: approvalUrl,
        requestor: requestor,
        bot: settings.user,
        commit: pr.head.sha,
        digest: digest
      };
      if (settings.useComments) {
        console.log(`Sent comment.`);
        return makeRequest(settings, commentPostUrl, {
          body: {
            body: `[cmd] \uD83D\uDEA2 \u23F1 ok @${requestor}, merging on green\n\nsee ${approvalUrl}\nverification code: ${digest}`
          }
        }).then(() => [pr, meta]);
      }
      return Promise.resolve([pr, meta]);
    })
    .then(z => {
      const pr = z[0];
      const meta = z[1];
      const u: string = pr.base.repo.commits_url;
      const post = u.replace("{/sha}", "/" + pr.head.sha) + "/comments";
      const stringy = yaml.safeDump(meta);
      return makeRequest(settings, post, {
        body: {
          body: `* pullmaster-1-shipit:\n\`\`\`yaml\n${stringy}\n\`\`\``
        }
      });
    });
}

function doMerge(settings, requestor, pr, approvalUrl, cmd) {
  const head = pr.head.sha;

  const icmd = cmd || "shipitnow";

  const info = [
    pr.title + "\n",
    `\u270D\uFE0F PR author: @${pr.user.login}`,
    `\uD83D\uDCD9 PR thread: ${pr.html_url}`,
    `\uD83D\uDEA2 #${icmd} from: @${requestor}`,
    `\uD83D\uDC4D #${icmd} at: @${approvalUrl}`
  ];
  return makeRequest(settings, pr.url + "/merge", {
    method: "PUT",
    body: {
      commit_title: `Merge pull request #${pr.number} from ${pr.head.label}`,
      commit_message: info.join("\n"),
      sha: head,
      merge_method: "merge"
    }
  })
    .then(b => {
      const s = JSON.stringify(b);
      console.log(`Submitted merge: ${s}`);
    })
    .catch(err => {
      console.log(`Merge exception`);
      if (err.statusCode == 405) {
        console.log(`Unable to merge.`);
        return makeRequest(settings, pr.comments_url, {
          body: {
            body: `[err] \uD83D\uDEA2 \u274C sorry @${requestor} - unable to merge. @${
              pr.user.login
            } - take a look at your pull request, resolve any issues first, and then try to merge again @${requestor}.`
          }
        });
      }
      throw err;
    });
}

function handleResponseThrow(settings, err, req, res) {
  if (200 <= err.statusCode && err.statusCode < 300) {
    res
      .status(err.statusCode)
      .send(err.message)
      .end();
    return;
  }
  console.error(err.stack);
  var msg = err.message;
  if (settings.spewStack) {
    msg = msg + "\n\n" + err.stack;
  }
  res
    .status(err.statusCode ? err.statusCode : 503)
    .send(msg)
    .end();
}

/**
 * Validates the request.
 * See https://developer.github.com/webhooks/securing.
 */
function validateRequest(settings: any, req: any) {
  return Promise.resolve().then(() => {
    const digest = crypto
      .createHmac("sha1", settings.secretToken)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (req.headers["x-hub-signature"] !== `sha1=${digest}`) {
      const error: any = new Error("Unauthorized");
      error.statusCode = 403;
      throw error;
    } else {
      console.log("Request validated.");
    }
  });
}

/**
 * Helper method for making requests to the GitHub API.
 */
function makeRequest(settings: any, uri: string, opts: ?any) {
  var options = opts || {}; // Add appropriate headers
  options.headers || (options.headers = {});
  options.headers.Accept =
    "application/vnd.github.machine-man-preview+json,application/vnd.github.black-cat-preview+json,application/vnd.github.v3+json"; // Send and accept JSON
  options.json = true;
  if (options.body) {
    options.headers["Content-Type"] = "application/json";
  } // Add authentication
  const parts = url.parse(uri);
  parts.auth = `${settings.user}:${settings.accessToken}`; // Make the request
  return got(parts, options).then(res => res.body);
}

/**
 * Recursively loads all open pull requests for the given repo.
 */
function getPullRequests(settings: any, repo: any, page: ?number) {
  const PAGE_SIZE = 100;
  if (!page) {
    page = 1;
  } // Retrieve a page of pull requests
  return makeRequest(settings, `${repo.url}/pulls`, {
    query: {
      sort: "updated",
      page,
      per_page: PAGE_SIZE
    }
  }).then(pullRequests => {
    // Filter out requested reviews who are not found in "settings.reviewers"
    pullRequests.forEach(pr => {
      pr.requested_reviewers || (pr.requested_reviewers = []);
      // Filter out reviewers not found in "settings.reviewers"
      pr.requested_reviewers = pr.requested_reviewers.filter(reviewer =>
        settings.reviewers.includes(reviewer.login)
      );
    }); // If more pages exists, recursively retrieve the next page
    if (pullRequests.length === PAGE_SIZE) {
      return getPullRequests(settings, repo, page + 1).then(_pullRequests =>
        pullRequests.concat(_pullRequests)
      );
    }
    // Finish by retrieving the pull requests' reviews
    return getReviewsForPullRequests(settings, pullRequests);
  });
}

/**
 * Loads the reviews for the given pull requests.
 */
function getReviewsForPullRequests(settings: any, pullRequests: Array<any>) {
  console.log(`Retrieving reviews for ${pullRequests.length} pull requests.`); // Make a request for each pull request's reviews
  const tasks = pullRequests.map(pr =>
    makeRequest(settings, `${pr.url}/reviews`)
  );
  // Wait for all requests to complete
  return Promise.all(tasks).then(responses => {
    responses.forEach((reviews, i) => {
      reviews || (reviews = []); // Attach the reviews to each pull request
      pullRequests[i].reviews = reviews
        // Filter out reviews whose reviewers are not found in
        // "settings.reviewers"
        .filter(review => settings.reviewers.includes(review.user.login))
        // Only reviews with changes requested count against a reviewer's
        // workload
        .filter(review => review.state === "CHANGES_REQUESTED");
    });
    return pullRequests;
  });
}

/**
 * Calculates the current workloads of the reviewers specified in
 * "settings.reviewers".
 */
function calculateWorkloads(settings: any, pullRequests: Array<any>) {
  // Calculate the current workloads of each reviewer
  const reviewers = {};
  settings.reviewers.forEach(reviewer => {
    reviewers[reviewer] = 0;
  });
  pullRequests.forEach((pr, i) => {
    // These are awaiting the reviewer's initial review
    pr.requested_reviewers.forEach(reviewer => {
      reviewers[reviewer.login]++;
    }); // For these the reviewer has requested changes, and has yet to approve the // pull request
    pr.reviews.forEach(review => {
      reviewers[review.user.login]++;
    });
  });
  console.log(JSON.stringify(reviewers, null, 2)); // Calculate the reviewer with the smallest workload
  const workloads = [];
  Object.keys(reviewers).forEach(login => {
    workloads.push({
      login,
      reviews: reviewers[login]
    });
  });
  workloads.sort((a, b) => a.reviews - b.reviews);
  console.log(`Calculated workloads for ${workloads.length} reviewers.`);
  return workloads;
}

/**
 * Selects the next reviewer based on current reviewer workloads.
 */
function getNextReviewer(
  settings: any,
  pullRequest: any,
  pullRequests: Array<any>
) {
  let workloads = calculateWorkloads(settings, pullRequests);
  workloads = workloads // Remove reviewers who have a higher workload than the reviewer at the // front of the queue:
    .filter(workload => workload.reviews === workloads[0].reviews) // Remove the opener of the pull request from review eligibility:
    .filter(workload => workload.login !== pullRequest.user.login);
  const MIN = 0;
  const MAX = workloads.length - 1; // Randomly choose from the remaining eligible reviewers:
  const choice = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
  if (!workloads[choice]) {
    // No available reviewers.
    const error: any = new Error(`No eligible reviewers.`);
    error.statusCode = 202;
    throw error;
  }
  return workloads[choice].login;
}

/**
 * Assigns a reviewer to the given pull request.
 */
function assignReviewer(settings: any, reviewer: string, pullRequest: any) {
  console.log(`Assigning pull request to ${reviewer}.`);
  const primary = () => {
    makeRequest(settings, `${pullRequest.url}/requested_reviewers`, {
      body: {
        reviewers: [reviewer]
      }
    });
  };
  if (settings.useComments) {
    return makeRequest(settings, pullRequest.comments_url, {
      body: {
        body: `[task] \uD83D\uDCD9 \uD83D\uDC49 @${reviewer} please review`
      }
    }).then(primary);
  }
  return primary();
}

module.exports = {
  handle
};
