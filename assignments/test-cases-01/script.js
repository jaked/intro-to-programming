/*
 * Poor man's jQuery.
 */
function $(s, t) {
  if (s === undefined) {
    return $("<i>", "undefined")
  } else if (s[0] === "#") {
    return document.getElementById(s.substring(1));
  } else if (s[0] === "<") {
    const e = document.createElement(s.substring(1, s.length - 1));
    if (t != undefined) {
      e.append($(t));
    }
    return e;
  } else {
    return document.createTextNode(s);
  }
}

function withClass(className, e) {
  e.className = className;
  return e;
}

const jsonIfOk = (r) => {
  if (r.ok) {
    return r.json();
  }
  throw r;
};


const promisedTestCases = fetch("test-cases.json").then(jsonIfOk);

// Kludge to get the function assuming it was named with const or let and thus
// not on the window object.
const get = (name) => {
  try {
    return Function(`return ${name}`)();
  } catch {
    return void 0;
  }
};

const runTestCase = (fn, test) => {
  // Copy arg so test function can't mutate the test data.
  const got = fn(...JSON.parse(JSON.stringify(test.args)));
  const passed = JSON.stringify(got) === JSON.stringify(test.expected);
  return { ...test, got, passed };
};

const fnResults = (fn, cases) => cases.map((test) => runTestCase(fn, test));

const allResults = (testCases) => {
  return Object.fromEntries(testCases.map((spec) => {
    const fn = get(spec.name);
    return [spec.name, fn ? fnResults(fn, spec.cases) : [] ];
  }));
};

const makePills = (testCases) => {
  return  testCases.forEach((spec) => {
    $("#pills").append(pill(spec.name));
  });
};

const stylePills = (testResults) => {
  $("#pills").querySelectorAll("button").forEach((b) => {
    const results = testResults[b.value];
    b.classList.remove('no_results', 'some_failing', 'all_passing');
    b.classList.add(pillStyle(results));
    b.onclick = () => displayResults(b.value, results);
  });
}

const pill = (name) => {
  const b = withClass('no_results', $("<button>", name));
  b.value = name;
  return b;
};

const pillStyle = (results) => results.length === 0
      ? 'no_results'
      : results.every((x) => x.passed)
      ? 'all_passing'
      : 'some_failing';

const displayResults = (name, results) => {
  console.log(`${name} ${results}`);
}

// 1. Look at test cases and create pills style with 'no_results'.
promisedTestCases.then(makePills);

window.onCodeLoaded = (fn) => {

  promisedTestCases.then((testCases) => {
    const results = allResults(testCases);

    // 2. When code is loaded, compute all results and restyle pills. (If code
    // loaded before test cases, probably stash them for later.
    stylePills(results);

    fn(results);

    // 3. When pill is clicked, use the existing results to fill the results table
    // and display it.
  });

};
