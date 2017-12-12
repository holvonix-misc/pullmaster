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
    execute: bypassSecurity => {
      if (!bypassSecurity) {
        const digest = crypto
          .createHmac("sha1", mockSettings.secretToken)
          .update(JSON.stringify(mockReq.body))
          .digest("hex");
        mockReq.headers["x-hub-signature"] = `sha1=${digest}`;
      }
      return program.handle(mockSettings, mockReq, mockRes);
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
