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

const assert = require("assert");
const crypto = require("crypto");
const proxyquire = require("proxyquire").noCallThru();
const sinon = require("sinon");

function getSample() {
  const mockSettings = {
    secretToken: "foo",
    reviewers: ["bob", "alice"]
  };
  const mockGot = sinon.stub();

  const program = proxyquire("./index.js", {
    "./settings.json": mockSettings,
    got: mockGot
  });

  const mockReq = {
    headers: {
      "x-github-event": "pull_request"
    },
    body: {
      action: "opened",
      pull_request: {
        title: "Test",
        base: {
          repo: {
            url: "https://api.github.com/repos/test/test"
          }
        },
        user: {
          login: "test_dev"
        }
      }
    }
  };

  const mockRes = {
    send: sinon.stub().returnsThis(),
    end: sinon.stub().returnsThis(),
    status: sinon.stub().returnsThis()
  };

  return {
    execute: (bypassSecurity, overrideSettings) => {
      var settings = mockSettings;
      if (overrideSettings) {
        settings = Object.assign(settings, overrideSettings);
      }
      if (!bypassSecurity) {
        const digest = crypto
          .createHmac("sha1", settings.secretToken)
          .update(JSON.stringify(mockReq.body))
          .digest("hex");
        mockReq.headers["x-hub-signature"] = `sha1=${digest}`;
      }
      return program.handle(settings, mockReq, mockRes);
    },
    mocks: {
      got: mockGot,
      req: mockReq,
      res: mockRes
    }
  };
}

it("should only look at pull requests", () => {
  const sample = getSample();
  sample.mocks.req.headers["x-github-event"] = "repository";

  sample.execute();

  assert.equal(sample.mocks.res.end.callCount, 1);
});

it("should only look at new pull requests", () => {
  const sample = getSample();
  sample.mocks.req.body = {};

  sample.execute();

  assert.equal(sample.mocks.res.end.callCount, 1);
});

it("should validate request", () => {
  const sample = getSample();

  return sample.execute(true).then(() => {
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [403]);
    assert.equal(sample.mocks.res.send.callCount, 1);
    assert.deepEqual(sample.mocks.res.send.getCall(0).args, ["Unauthorized"]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});

it("should assign next reviewer", () => {
  const sample = getSample();

  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: [
        {
          requested_reviewers: [],
          user: {
            login: "dev_1"
          }
        },
        {
          requested_reviewers: [],
          user: {
            login: "dev_2"
          }
        }
      ]
    })
  );
  sample.mocks.got.onCall(1).returns(
    Promise.resolve({
      body: []
    })
  );
  sample.mocks.got.onCall(2).returns(
    Promise.resolve({
      body: [
        {
          user: {
            login: "bob"
          },
          state: "CHANGES_REQUESTED"
        }
      ]
    })
  );
  sample.mocks.got.onCall(3).returns(
    Promise.resolve({
      body: {}
    })
  );

  return sample.execute().then(() => {
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});

it("should skip pull requests with no eligible reviewers", () => {
  const sample = getSample();
  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: [
        {
          requested_reviewers: [],
          user: {
            login: "dev_1"
          }
        },
        {
          requested_reviewers: [],
          user: {
            login: "dev_2"
          }
        }
      ]
    })
  );
  sample.mocks.got.onCall(1).returns(
    Promise.resolve({
      body: []
    })
  );
  sample.mocks.got.onCall(2).returns(
    Promise.resolve({
      body: [
        {
          user: {
            login: "bob"
          },
          state: "CHANGES_REQUESTED"
        }
      ]
    })
  );

  return sample.execute(false, { reviewers: ["test_dev"] }).then(() => {
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [202]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});

function getIssueCommentSample() {
  const mockSettings = {
    secretToken: "foo",
    reviewers: ["bob", "alice"],
    useComments: true,
    metadataSealSecretToken: "ef983ludej..ke.d93i/",
    admins: ["admin_dev"]
  };
  const mockGot = sinon.stub();

  const program = proxyquire("./index.js", {
    "./settings.json": mockSettings,
    got: mockGot
  });

  const mockReq = {
    headers: {
      "x-github-event": "issue_comment"
    },
    body: {
      action: "created",
      issue: {
        pull_request: { url: "/pull/15" },
        comments_url: "/comments"
      },
      comment: {
        body: "Yes\r\n\r\n#shipitnow indeed.",
        html_url: "/issue/comment",
        user: {
          login: "admin_dev"
        }
      }
    }
  };

  const mockRes = {
    send: sinon.stub().returnsThis(),
    end: sinon.stub().returnsThis(),
    status: sinon.stub().returnsThis()
  };

  return {
    execute: (bypassSecurity, overrideSettings) => {
      var settings = mockSettings;
      if (overrideSettings) {
        settings = Object.assign(settings, overrideSettings);
      }
      if (!bypassSecurity) {
        const digest = crypto
          .createHmac("sha1", settings.secretToken)
          .update(JSON.stringify(mockReq.body))
          .digest("hex");
        mockReq.headers["x-hub-signature"] = `sha1=${digest}`;
      }
      return program.handle(settings, mockReq, mockRes);
    },
    mocks: {
      got: mockGot,
      req: mockReq,
      res: mockRes
    }
  };
}

it("should merge and post comment on #shipitnow comment", () => {
  const sample = getIssueCommentSample();

  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: {}
    })
  );

  sample.mocks.got.onCall(1).returns(
    Promise.resolve({
      body: {
        title: "title",
        url: "/pull/15",
        base: {
          repo: {
            commits_url: "/commits{/sha}"
          }
        },
        head: {
          sha: "sha1",
          label: "repo/branch"
        },
        user: {
          login: "pr-author"
        },
        html_url: "/html",
        number: 15
      }
    })
  );

  sample.mocks.got.onCall(2).returns(
    Promise.resolve({
      body: {}
    })
  );

  return sample.execute().then(() => {
    assert(sample.mocks.got.calledThrice);
    assert(
      sample.mocks.got.args[0][1].body.body.includes(
        "ok @admin_dev, merging immediately"
      )
    );
    assert.equal(sample.mocks.got.args[2][0].path, "/pull/15/merge");
    assert.deepEqual(sample.mocks.got.args[2][1].body, {
      commit_message:
        "title\n\n✍️ PR author: @pr-author\n📙 PR thread: /html\n🚢 #shipitnow from: @admin_dev\n👍 #shipitnow at: @/issue/comment",
      commit_title: "Merge pull request #15 from repo/branch",
      merge_method: "merge",
      sha: "sha1"
    });
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should post comment on #shipit comment", () => {
  const sample = getIssueCommentSample();
  sample.mocks.req.body.comment.body = "Hey now, #shipit.";
  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: {
        title: "title",
        url: "/pull/15",
        base: {
          repo: {
            commits_url: "/commits{/sha}"
          }
        },
        head: {
          sha: "sha1",
          label: "repo/branch"
        },
        user: {
          login: "pr-author"
        },
        html_url: "/html",
        number: 15
      }
    })
  );
  sample.mocks.got.onCall(1).returns(
    Promise.resolve({
      body: {}
    })
  );
  sample.mocks.got.onCall(2).returns(
    Promise.resolve({
      body: {}
    })
  );
  return sample.execute().then(() => {
    assert(sample.mocks.got.calledThrice);
    assert(
      sample.mocks.got.args[1][1].body.body.includes(
        "ok @admin_dev, merging on green"
      )
    );
    assert.equal(sample.mocks.got.args[2][0].path, "/commits/sha1/comments");
    assert.equal(
      sample.mocks.got.args[2][1].body.body,
      `* pullmaster-1-shipit:
\`\`\`yaml
pr: 15
url: /pull/15
shipit: /issue/comment
requestor: admin_dev
bot: '#non-existent-example-bot'
commit: sha1
digest: 9ff058ec2a2ea1163cf0577f56ebb008a40d8592f12c5d1eac5c1b2421709df0

\`\`\``
    );
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should not post comment on #shipit comment without useComments", () => {
  const sample = getIssueCommentSample();
  sample.mocks.req.body.comment.body = "Hey now, #shipit.";
  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: {
        title: "title",
        url: "/pull/15",
        base: {
          repo: {
            commits_url: "/commits{/sha}"
          }
        },
        head: {
          sha: "sha1",
          label: "repo/branch"
        },
        user: {
          login: "pr-author"
        },
        html_url: "/html",
        number: 15
      }
    })
  );
  sample.mocks.got.onCall(1).returns(
    Promise.resolve({
      body: {}
    })
  );
  return sample.execute(false, { useComments: false }).then(() => {
    assert(sample.mocks.got.calledTwice);
    assert(sample.mocks.got.args[1][1].body.body.includes("pullmaster"));
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should merge and not post comment on #shipitnow comment without useComments", () => {
  const sample = getIssueCommentSample();
  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: {
        title: "title",
        url: "/pull/15",
        head: {
          sha: "sha1",
          label: "repo/branch"
        },
        user: {
          login: "pr-author"
        },
        html_url: "/html",
        number: 15
      }
    })
  );
  sample.mocks.got.onCall(1).returns(
    Promise.resolve({
      body: {}
    })
  );
  return sample.execute(false, { useComments: false }).then(() => {
    assert(sample.mocks.got.calledTwice);
    assert.equal(sample.mocks.got.args[1][0].path, "/pull/15/merge");
    assert.deepEqual(sample.mocks.got.args[1][1].body, {
      commit_message:
        "title\n\n✍️ PR author: @pr-author\n📙 PR thread: /html\n🚢 #shipitnow from: @admin_dev\n👍 #shipitnow at: @/issue/comment",
      commit_title: "Merge pull request #15 from repo/branch",
      merge_method: "merge",
      sha: "sha1"
    });
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should ignore comments by non-admins", () => {
  const sample = getIssueCommentSample();
  sample.mocks.req.body.comment.user.login = "non-admin";
  return sample.execute().then(() => {
    assert(sample.mocks.got.notCalled);
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [202]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should ignore comments without commands", () => {
  const sample = getIssueCommentSample(); // needs whitespace
  sample.mocks.req.body.comment.body = "never#shipit";
  return sample.execute().then(() => {
    assert(sample.mocks.got.notCalled);
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [202]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
function getReviewSample() {
  const mockSettings = {
    secretToken: "foo",
    reviewers: ["bob", "alice"],
    useComments: true,
    metadataSealSecretToken: "d4r3r",
    admins: ["admin_dev"]
  };
  const mockGot = sinon.stub();
  const program = proxyquire("./index.js", {
    "./settings.json": mockSettings,
    got: mockGot
  });
  const mockReq = {
    headers: {
      "x-github-event": "pull_request_review"
    },
    body: {
      action: "submitted",
      pull_request: {
        title: "title",
        url: "/pull/15",
        number: 15,
        head: {
          sha: "sha1",
          label: "repo/branch"
        },
        user: {
          login: "pr-author"
        },
        html_url: "/html",
        comments_url: "/comments",
        base: {
          repo: {
            commits_url: "/commits{/sha}"
          }
        }
      },
      review: {
        body: "Yes\r\n\r\n#shipitnow indeed.",
        html_url: "/review",
        user: {
          login: "admin_dev"
        }
      }
    }
  };
  const mockRes = {
    send: sinon.stub().returnsThis(),
    end: sinon.stub().returnsThis(),
    status: sinon.stub().returnsThis()
  };
  return {
    execute: (bypassSecurity, overrideSettings) => {
      var settings = mockSettings;
      if (overrideSettings) {
        settings = Object.assign(settings, overrideSettings);
      }
      if (!bypassSecurity) {
        const digest = crypto
          .createHmac("sha1", settings.secretToken)
          .update(JSON.stringify(mockReq.body))
          .digest("hex");
        mockReq.headers["x-hub-signature"] = `sha1=${digest}`;
      }
      return program.handle(settings, mockReq, mockRes);
    },
    mocks: {
      got: mockGot,
      req: mockReq,
      res: mockRes
    }
  };
}
it("should merge and post comment on #shipitnow review", () => {
  const sample = getReviewSample();
  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: {}
    })
  );
  sample.mocks.got.onCall(1).returns(
    Promise.resolve({
      body: {}
    })
  );
  return sample.execute().then(() => {
    assert(sample.mocks.got.calledTwice);
    assert(
      sample.mocks.got.args[0][1].body.body.includes(
        "ok @admin_dev, merging immediately"
      )
    );
    assert.equal(sample.mocks.got.args[1][0].path, "/pull/15/merge");
    assert.deepEqual(sample.mocks.got.args[1][1].body, {
      commit_message:
        "title\n\n✍️ PR author: @pr-author\n📙 PR thread: /html\n🚢 #shipitnow from: @admin_dev\n👍 #shipitnow at: @/review",
      commit_title: "Merge pull request #15 from repo/branch",
      merge_method: "merge",
      sha: "sha1"
    });
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should post comment on #shipit review", () => {
  const sample = getReviewSample();
  sample.mocks.req.body.review.body = "Hey now, #shipit.";
  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: {}
    })
  );
  sample.mocks.got.onCall(1).returns(
    Promise.resolve({
      body: {}
    })
  );
  return sample.execute().then(() => {
    assert(sample.mocks.got.calledTwice);
    assert(
      sample.mocks.got.args[0][1].body.body.includes(
        "ok @admin_dev, merging on green"
      )
    );
    assert.equal(sample.mocks.got.args[1][0].path, "/commits/sha1/comments");
    assert(sample.mocks.got.args[1][1].body.body.includes("pullmaster"));
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should not post comment on #shipit review without useComments", () => {
  const sample = getReviewSample();
  sample.mocks.req.body.review.body = "Hey now, #shipit.";
  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: {}
    })
  );
  return sample.execute(false, { useComments: false }).then(() => {
    assert(sample.mocks.got.calledOnce);
    assert(sample.mocks.got.args[0][1].body.body.includes("pullmaster"));
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should merge and not post comment on #shipitnow review without useComments", () => {
  const sample = getReviewSample();
  sample.mocks.got.onCall(0).returns(
    Promise.resolve({
      body: {}
    })
  );
  return sample.execute(false, { useComments: false }).then(() => {
    assert(sample.mocks.got.calledOnce);
    assert.equal(sample.mocks.got.args[0][0].path, "/pull/15/merge");
    assert.deepEqual(sample.mocks.got.args[0][1].body, {
      commit_message:
        "title\n\n✍️ PR author: @pr-author\n📙 PR thread: /html\n🚢 #shipitnow from: @admin_dev\n👍 #shipitnow at: @/review",
      commit_title: "Merge pull request #15 from repo/branch",
      merge_method: "merge",
      sha: "sha1"
    });
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should ignore reviews by non-admins", () => {
  const sample = getReviewSample();
  sample.mocks.req.body.review.user.login = "non-admin";
  return sample.execute().then(() => {
    assert(sample.mocks.got.notCalled);
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [202]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should fail to merge and complain on #shipitnow review with 405 without useComments", () => {
  const sample = getReviewSample();
  var mergeError = new Error("Cannot merge");
  mergeError.statusCode = 405;
  sample.mocks.got.onCall(0).returns(Promise.reject(mergeError));
  sample.mocks.got.onCall(1).returns(
    Promise.resolve({
      body: {}
    })
  );
  return sample.execute(false, { useComments: false }).then(() => {
    assert(sample.mocks.got.calledTwice);
    assert.equal(sample.mocks.got.args[0][0].path, "/pull/15/merge");
    assert.deepEqual(sample.mocks.got.args[0][1].body, {
      commit_message:
        "title\n\n✍️ PR author: @pr-author\n📙 PR thread: /html\n🚢 #shipitnow from: @admin_dev\n👍 #shipitnow at: @/review",
      commit_title: "Merge pull request #15 from repo/branch",
      merge_method: "merge",
      sha: "sha1"
    });
    assert(sample.mocks.got.args[1][1].body.body.includes("sorry"));
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [200]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should fail to merge and not complain on #shipitnow review with 503", () => {
  const sample = getReviewSample();
  var mergeError = new Error("Cannot merge");
  mergeError.statusCode = 503;
  sample.mocks.got.onCall(0).returns(Promise.reject(mergeError));
  return sample.execute(false, { useComments: false }).then(() => {
    assert(sample.mocks.got.calledOnce);
    assert.equal(sample.mocks.got.args[0][0].path, "/pull/15/merge");
    assert.deepEqual(sample.mocks.got.args[0][1].body, {
      commit_message:
        "title\n\n✍️ PR author: @pr-author\n📙 PR thread: /html\n🚢 #shipitnow from: @admin_dev\n👍 #shipitnow at: @/review",
      commit_title: "Merge pull request #15 from repo/branch",
      merge_method: "merge",
      sha: "sha1"
    });
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [503]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
}); //pull_request:labeled{label.name=shipit, pull_request.mergeable_state=clean}
it("should ignore reviews by non-admins", () => {
  const sample = getReviewSample();
  sample.mocks.req.body.review.user.login = "non-admin";
  return sample.execute().then(() => {
    assert(sample.mocks.got.notCalled);
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [202]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
it("should ignore reviews without commands", () => {
  const sample = getReviewSample(); // needs whitespace
  sample.mocks.req.body.review.body = "never#shipit";
  return sample.execute().then(() => {
    assert(sample.mocks.got.notCalled);
    assert.equal(sample.mocks.res.status.callCount, 1);
    assert.deepEqual(sample.mocks.res.status.getCall(0).args, [202]);
    assert.equal(sample.mocks.res.end.callCount, 1);
  });
});
