import Login from './modules/login';
import files from './modules/files';
import github from './modules/github';
import makeEvaluator from './modules/evaluator';
import monaco from './modules/editor';
import replize from './modules/repl';
import testing from './modules/testing';
import { jsonIfOk } from './modules/fetch-helpers';
import { choice } from './modules/shuffle';
import fruit from './modules/fruit';

const GITHUB_ORG = 'gigamonkeys'; // FIXME: load this from config file from website.
const TEMPLATE_OWNER = 'gigamonkey';
const TEMPLATE_REPO = 'itp-template';
// const CANONICAL_VERSION = 'https://raw.githubusercontent.com/gigamonkey/itp-template/main/.version';

// This is basically a null set of protections, just to get rid of that
// annoying, "You haven't protected your main branch!" warning on the website.
// We'd kinda like to require pull requests to main except that our own code
// wants to directly create files in main. I think in theory if this was a
// proper GitHub App, I might be able to allow the app to do it while otherwise
// requiring PRs. Something to investigate later.
const mainBranchProtections = {
  required_status_checks: null,
  enforce_admins: true,
  restrictions: null,
  required_pull_request_reviews: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: false,
};

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);

const login = new Login();

////////////////////////////////////////////////////////////////////////////////
// UI manipulations

const el = (name, text) => {
  const e = document.createElement(name);
  if (text) e.innerText = text;
  return e;
};

const text = (t) => document.createTextNode(t);

const a = (text, href, target) => {
  const e = el('a', text);
  e.setAttribute('href', href);
  if (target) e.setAttribute('target', target);
  return e;
};

const url = (s) => {
  const e = el('a', s);
  e.href = s;
  return e;
};

const message = (text, fade) => {
  $('#minibuffer').innerText = text;
  if (fade) {
    setTimeout(() => {
      if ($('#minibuffer').innerText === text) {
        $('#minibuffer').innerText = '';
      }
    }, fade);
  }
};

const showLoggedIn = () => {
  const button = $('#toolbar-login');
  const icon = $('#github-icon');
  const u = login.repoURL ? a(login.username, login.repoURL, '_blank') : text(login.username);
  button.parentNode.replaceChildren(icon, u);
};

const toggleInfo = () => {
  if ($('#banner').hidden) {
    showInfo();
  } else {
    hideInfo();
  }
};

const showInfo = () => {
  const b = $('#banner');
  $$('#banner > div').forEach((e) => {
    e.hidden = true;
  });
  b.querySelector('.x').style.display = 'inline';
  b.querySelector('.info').hidden = false;
  b.hidden = false;
};

const hideInfo = () => {
  $('#banner').hidden = true;
};

const showBanner = () => {
  const b = $('#banner');

  if (login.anonymous || (login.ok && !login.createdRepo)) {
    b.hidden = true;
  } else {
    // Hide everything ...
    $$('#banner > div').forEach((e) => {
      e.hidden = true;
    });
    b.querySelector('.x').style.display = 'none';

    // ... and then show the right thing.
    if (!login.isLoggedIn) {
      b.querySelector('.logged-out').hidden = false;
    } else if (!login.isMember) {
      $('#banner .profile-url > span').replaceChildren(url(login.profileURL));
      $('#banner .profile-url > svg').onclick = () => {
        navigator.clipboard.writeText(login.profileURL);
      };
      b.querySelector('.not-a-member').hidden = false;
    } else if (login.problemMakingRepo) {
      b.querySelector('.x').style.display = 'inline';
      b.querySelector('.problem-with-repo').hidden = false;
    } else if (login.createdRepo) {
      b.querySelector('.x').style.display = 'inline';
      const div = b.querySelector('.created-repo');
      div.querySelector('span').replaceChildren(url(login.repoURL));
      div.hidden = false;
    }

    b.hidden = false;
  }
};

const hideBanner = () => {
  $('#banner').hidden = true;
};

const goAnonymous = () => {
  login.anonymous = true;
  showBanner();
};

// End UI manipulations
////////////////////////////////////////////////////////////////////////////////

const editor = monaco('editor');
const repl = replize('repl');

/*
const checkRepoVersion = async (repo) => {
  const [expected, got] = await Promise.all([
    fetch(CANONICAL_VERSION).then(jsonIfOk),
    repo
      .getFile('.version')
      .then((f) => JSON.parse(atob(f.content)))
      .catch(() => 'No .version file'),
  ]);
  return repo;
};
*/

// The window.location.pathname thing below is part of our base href kludge to
// deal with the monaco worker plugin files (see modules/editor.js). Since we've
// likely set a <base> in our HTML we need to do this gross thing to convert
// this back to a relative link.
const configuration = async () => fetch(`${window.location.pathname}config.json`).then(jsonIfOk);

const connectToGithub = async () => {
  hideBanner();

  const siteId = '6183282f-af29-4a93-a442-6c5bfb43a44f';
  const gh = await github.connect(siteId);

  login.logIn(gh.user.login, gh.user.html_url);

  let repo = null;

  if (await gh.membership(GITHUB_ORG)) {
    login.isMember = true;

    try {
      repo = await gh.orgRepos(GITHUB_ORG).getRepo(login.username);
    } catch (e) {
      try {
        repo = await gh
          .orgRepos(GITHUB_ORG)
          .makeRepoFromTemplate(login.username, TEMPLATE_OWNER, TEMPLATE_REPO);

        // Record that we created the repo now so we can show a banner about it.
        login.createdRepo = true;
      } catch (e) {
        console.log(e); // So I can debug if student runs into this.
        login.problemMakingRepo = e;
        repo = null;
      }
    }
  }

  if (repo !== null) {
    tryToProtectMain(repo);
    login.repoURL = repo.url;
  }

  showLoggedIn();

  if (repo === null || login.createdRepo) {
    showBanner();
  }

  return repo;
};

// It seems that the process for adding a user as an admin for their own repo
// happens asynchronously so immeediately after we made the repo they may not
// yet have the permissions needed to change the branch protection. So we'll
// just check that it's protected. (Kinda a bummer, I guess, that we check this
// every time they go to a new page. Hmmm.)
const tryToProtectMain = (repo) =>
  repo.getBranchProtection('main').catch(() => {
    repo.updateBranchProtection('main', mainBranchProtections).catch(() => {
      console.log("Couldn't protect main. We'll try again later.");
    });
  });

const makeStorage = async () => {
  let branch = window.location.pathname.substring(1);

  if (branch.endsWith('/')) {
    branch = branch.substring(0, branch.length - 1);
  }

  let repo = null;
  if (github.hasToken()) {
    repo = await connectToGithub();
  } else {
    repo = null;
    showBanner();
  }

  return files(branch, repo);
};

const maybeSetupTesting = (config) => {
  if (config.testing) {
    const testCases = config.testing.cases;
    const t = testing($(config.testing.id), testCases);
    return () => {
      window.runTests(testCases, (r) => t.update(r));
    };
  } else {
    return () => console.log('no testing callback');
  }
};

const randomFruitBomb = () => {
  const m = editor.getModel();
  const line = Math.floor(Math.random() * m.getLineCount());
  const column = Math.floor(Math.random() * m.getLineContent(line).length);
  m.applyEdits([
    {
      range: { startLineNumber: line, endLineNumber: line, startColumn: column, endColumn: column },
      text: choice(fruit),
    },
  ]);
};

const setup = async () => {
  const config = await configuration();
  const storage = await makeStorage();
  const evaluator = makeEvaluator(config.iframe, config.script, repl, message);

  const testingCallback = maybeSetupTesting(config);

  const [filename] = config.files;

  // Put code in editor and evaluate it.
  const fillEditor = (code) => {
    editor.setValue(code);
    evaluator.load(code, filename, testingCallback);
  };

  // Evaluate code now in editor and also save it.
  const reevaluateCode = () => {
    const code = editor.getValue();
    storage.save(filename, code).then((f) => {
      if (f.updated || f.created) {
        console.log('Saved.'); // FIXME: should show this in the web UI somewhere.
      }
    });
    evaluator.load(code, filename, testingCallback);
  };

  // For when we log in to GitHub after the user has loaded the page and maybe
  // even edited the file. FIXME: this doesn't do anything with the machinery
  // (which probably isn't fully baked) for saving versions of files while
  // disconnected.
  const attachToGithub = async () => {
    if (login.isLoggedIn) return;

    storage.repo = await connectToGithub();

    const current = editor.getValue();
    const starter = await storage.loadFromWeb(filename);
    const inRepo = await storage.ensureFileInBranch(filename);

    if (current === starter && inRepo !== starter) {
      // I.e. we loaded the page, got the starter, and then logged in
      // immediately. Switch to repo version.
      fillEditor(inRepo);
    } else if (current !== starter && current !== inRepo) {
      // We loaded the page, messed about with the code, and then logged in.
      // Don't really need to do anything since we're just going to leave things
      // as they are. However might be nice to ask if they want to revert to
      // what's in the repo. Or show a diff. Or whatever. If they then evaluate
      // the code it will be saved, stomping the latet verson in git. Of course,
      // old versions are recoverable from git though not presently through this
      // code UI.
    }
  };

  if (storage.repo !== null) {
    storage.ensureFileInBranch(filename).then(fillEditor);
  } else {
    storage.load(filename).then(fillEditor);
  }

  $('#login').onclick = attachToGithub;
  $('#anonymous').onclick = goAnonymous;
  if ($('#toolbar-login')) {
    $('#toolbar-login').onclick = attachToGithub;
  }
  $('#info-circle').onclick = toggleInfo;
  $('#banner svg.x').onclick = hideInfo;
  $('#submit').onclick = reevaluateCode;

  $('#minibuffer').onclick = () => {
    $('#minibuffer').innerText = '';
  };

  repl.focus();
};

setup();
