// Basic plan.

// Generate a bunch of random expressions whose complexity is based on 
// the current level. (E.g. initially just simple values, maybe of one type;
// later more complex expressions.) These make up the palette for a level.

// Levels (values):
//  0: just numbers
//  1: just strings and numbers for indices.
//  2: just booleans
//  3: numbers and strings
//  4: homogeneous arrays
//  5: numbers, strings, booleans, and homogenous arrays
//  6: add heterogenous arrays but no nesting
//  7: add nested heterogenous arrays
//  8: arithmetic expressions
//  9: string expressions

// Then generate random questions: pick one or more expressions at random
// and then generate a random expression with that many holes in it and
// evaluate it with the selected expressions to get the result. By construction
// the expressions needed to fill the holes exist.

let types = ["number", "string", "boolean", "array"];

let minNumber = -10;
let maxNumber = 20;
let words = ["food", "orange", "duck", "computer", "grue"];
let maxArrayLength = 3;

class Generator {

  number() { return this.int(minNumber, maxNumber); }

  string() { return this.choice(words); }

  boolean() { return Math.random() < 0.5; }

  array() { return Array(this.int(maxArrayLength + 1)).fill().map(this.arrayTypeFunction().bind(this)); }

  value() { return this.typeFunction().bind(this)(); }

  valueOf(type) { return this[type](); }

  values(n) { return Array(n).fill().map(this.value.bind(this)); }

  int(min, max) {
    if (max === undefined) {
      [min, max] = [0, min]
    }
    return min + Math.floor(Math.random() * (max - min));
  }

  choice(choices) { return choices[this.int(choices.length)]; }

  arrayTypeFunction() { return this.choice([this.number, this.string, this.boolean]); }

  typeFunction() { return this.choice([this.number, this.string, this.boolean, this.array]); }

}

let g = new Generator();

let operators = {
  number: ["+", "-", "*", "/", "%", "<", "<=", ">", ">=", "===", "!="],
  string: ["+", "[]"],
  boolean: ["!", "&&", "||"],
  array: ["[]"],
}

class Value {
  constructor(value) {
    this.value = value;
  }
  evaluate() { return this.value; }
  render(parent) { parent.append($(JSON.stringify(this.value))); }
}

/*
 * A blank spot in an expression that needs to be filled in.
 */
class Blank extends Value {
  render(parent) { parent.append(withClass("hole", $("<span>"))); }
}

class NumberPlus {
  constructor(a, b) {
    this.a = a;
    this.b = b;
  }
  evaluate() { return this.a.evaluate() + this.b.evaluate(); }
  render(parent) {
    this.a.render(parent);
    parent.append($(" + "));
    this.b.render(parent);
  }
}

function forBlanks(blanks) {
  // This is stupidly hardwired.
  if (blanks.length == 1) {
    return new NumberPlus(blanks[0], new Value(g.valueOf('number')));
  } else if (blanks.length == 2) {
    return new NumberPlus(blanks[0], blanks[1]);
  }
}

function expressionQuestion(values) {
  return forBlanks(Array.from(values).map(v => new Blank(v)));
}

// Get the type as far as we are concerned.
function type(value) {
  let t = typeof value;
  switch (t) {
    case 'number':
    case 'string':
    case 'boolean':
      return t;
    default:
      return Array.isArray(value) ? 'array' : 'unknown';
  }
}

let model = {
  currentAnswers: [],
};

function init() {
  model.currentAnswers = uniqueAnswers();
  populateAnswers(model.currentAnswers);
  setQuestion();
}

function setQuestion() {
  const div = $("#question");
  let a = g.choice(model.currentAnswers);
  let expr = forBlanks([new Blank(a)]);
  console.log(expr);
  expr.render(div);
  div.append($(" ⟹ "));
  div.append($(JSON.stringify(expr.evaluate())));
}

function populateAnswers(answers) {
  const div = $("#answers");
  for (const v of answers) {
    let json = JSON.stringify(v);
    let b = $("<button>", json);
    b.value = json;
    b.onclick = e => console.log(e.target.value + ": " + type(JSON.parse(e.target.value)));
    div.append(b);
  }
}

function uniqueAnswers() {
  let count = 0;
  let seen = {};
  let answers = [];
  while (count < 20) {
    let v = g.number();
    let json = JSON.stringify(v);
    if (!(json in seen)) {
      seen[json] = true;
      count++;
      answers.push(v);
    }
  }
  return answers;
}

