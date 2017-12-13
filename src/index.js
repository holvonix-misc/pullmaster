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

const defaultSettings = {
  user: "__non-existent-example-bot",
  secretToken: "WebHook shared secret",
  accessToken: "OAUTH access token",
  reviewers: ["__non-existent-example-user"],
  // people who can issue commands via comments
  admins: ["__non-existent-example-admin"],
  // add comments showing what the bot does
  useComments: false
};

function handle(settings: any, req: any, res: any) {
  const action = req.body.action;
  const event = req.headers["x-github-event"];

  if (event === "pull_request") {
    if (action === "opened") {
      return handlePullRequestOpened(settings, req, res);
    }
  } else if (event == "issue_comment" && "pull_request" in req.body.issue) {
    if (action === "created") {
      return handlePullRequestCommentCreated(settings, req, res);
    }
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

  // Validate the request
  return (
    validateRequest(settings, req)
      // Download all pull requests
      .then(() => getPullRequests(settings, pullRequest.base.repo))
      // Figure out who should review the new pull request
      .then(pullRequests =>
        getNextReviewer(settings, pullRequest, pullRequests)
      )
      // Assign a reviewer to the new pull request
      .then(nextReviewer => assignReviewer(settings, nextReviewer, pullRequest))
      .then(() => {
        res.status(200).end();
      })
      .catch(err => {
        handleResponseThrow(settings, err, req, res);
      })
  );
}

/**
 * Handles commands issues via a pull request comment.
 */
function handlePullRequestCommentCreated(settings: any, req: any, res: any) {
  const pullRequest = req.body.issue.pull_request;
  const pullRequestUrl = req.body.issue.pull_request.url;
  const author = req.body.comment.user.login || "";
  const content = req.body.comment.body || "";
  const commentPostUrl = req.body.issue.comments_url;
  console.log(`Comment on PR: ${pullRequest.title} by ${author}`);

  // Validate the request
  return validateRequest(settings, req)
    .then(() => {
      if (!settings.admins.includes(author)) {
        // Ignore commands from non-admins
        const error: any = new Error(`${author} is not an admin`);
        error.statusCode = 202;
        throw error;
      }
      console.log(`Is admin: ${author}`);
    })
    .then(() => {
      if (content.match(/(^|\s)#shipitnow($|\b)/gim)) {
        const postIt = () => {
          makeRequest(settings, pullRequestUrl).then(pr => {
            console.log(`Got PR info: ${pr.html_url}`);
            const head = pr.head.sha;
            const info = [
              `Pull request author: @${pr.user.login}`,
              `#shipitnow requested by: @${author}`,
              `Pull request thread: ${pr.html_url}`
            ];
            return makeRequest(settings, pullRequestUrl + "/merge", {
              body: {
                commit_title: `Merge pull request #${pr.number} from ${
                  pr.head.label
                }`,
                commit_message: info.join("\n\n"),
                sha: head,
                merge_method: "merge"
              }
            }).then(b => {
              const s = JSON.stringify(b);
              console.log(`Submitted merge: ${s}`);
            });
          });
        };
        if (settings.useComments) {
          console.log(`Sent comment.`);
          return makeRequest(settings, commentPostUrl, {
            body: {
              body: `Command: Per @${author}, merging immediately`
            }
          }).then(postIt);
        }
        return postIt();
      } else if (content.match(/(^|\s)#shipit($|\b)/gim)) {
        // TODO: merge when green
        if (settings.useComments) {
          return makeRequest(settings, commentPostUrl, {
            body: {
              body: `Command: Per @${author}, merging when CI status is green (TODO)`
            }
          });
        }
      }

      // Ignore anything that is not a known command
      const error: any = new Error(`No known command in body.`);
      error.statusCode = 202;
      throw error;
    })
    .then(() => {
      res.status(200).end();
    })
    .catch(err => {
      handleResponseThrow(settings, err, req, res);
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
  var options = opts || {};

  // Add appropriate headers
  options.headers || (options.headers = {});
  options.headers.Accept =
    "application/vnd.github.machine-man-preview+json,application/vnd.github.black-cat-preview+json,application/vnd.github.v3+json";

  // Send and accept JSON
  options.json = true;
  if (options.body) {
    options.headers["Content-Type"] = "application/json";
    if (typeof options.body === "object") {
      options.body = JSON.stringify(options.body);
    }
  }

  // Add authentication
  const parts = url.parse(uri);
  parts.auth = `${settings.user}:${settings.accessToken}`;

  // Make the request
  return got(parts, options).then(res => res.body);
}

/**
 * Recursively loads all open pull requests for the given repo.
 */
function getPullRequests(settings: any, repo: any, page: ?number) {
  const PAGE_SIZE = 100;

  if (!page) {
    page = 1;
  }

  // Retrieve a page of pull requests
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
    });

    // If more pages exists, recursively retrieve the next page
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
  console.log(`Retrieving reviews for ${pullRequests.length} pull requests.`);
  // Make a request for each pull request's reviews
  const tasks = pullRequests.map(pr =>
    makeRequest(settings, `${pr.url}/reviews`)
  );
  // Wait for all requests to complete
  return Promise.all(tasks).then(responses => {
    responses.forEach((reviews, i) => {
      reviews || (reviews = []);
      // Attach the reviews to each pull request
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
    });
    // For these the reviewer has requested changes, and has yet to approve the
    // pull request
    pr.reviews.forEach(review => {
      reviewers[review.user.login]++;
    });
  });

  console.log(JSON.stringify(reviewers, null, 2));

  // Calculate the reviewer with the smallest workload
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

  workloads = workloads
    // Remove reviewers who have a higher workload than the reviewer at the
    // front of the queue:
    .filter(workload => workload.reviews === workloads[0].reviews)
    // Remove the opener of the pull request from review eligibility:
    .filter(workload => workload.login !== pullRequest.user.login);

  const MIN = 0;
  const MAX = workloads.length - 1;

  // Randomly choose from the remaining eligible reviewers:
  const choice = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;

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
        body: `Workflow: Assigning pull request to @${reviewer}.`
      }
    }).then(primary);
  }
  return primary();
}

module.exports = {
  handle
};
