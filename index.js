var fs = require('fs')
var _ = require('lodash')
var glob = require('glob')
var cheerio = require('cheerio')
var Table = require('cli-table');

var stats = {}

readFiles(processFiles)

function readFiles(cb) {
  glob(__dirname+'/guardias/*.html', function(err, files) {
    if (err) console.log('problem finding files', err)
    else cb(files)
  })
}

function processFiles(files) {
  var n = files.length
  function done() {
    if (--n === 0) statsCollected(stats)
  }
  files.forEach(function(f) {
    return readFile(f, _.flow(
      processFile.bind(null, f),
      mergeStats,
      done
    ))
  })
}

var weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
function statsCollected(stats) {
  var table = new Table({
    head: ['Who'].concat(weekDayLabels)
  });

  table.push.apply(table, _.map(stats, function(days, who) {
    return [who].concat(_.range(weekDayLabels.length).map(function(i) {
      return days[weekDayLabels[i]] || ''
    }))
  }).sort(function(a, b) {
    var first = -1, later = 1
    var keys = [7, 1, 2, 3, 4, 5, 6, 0], k
    for (var i = 0; i < keys.length && (k=keys[i]); i++) {
      if (a[k] > b[k]) return first
      else if (a[k] < b[k]) return later
    }
    return 0;
  }))

  console.log(table.toString());
}

function readFile(path, cb) {
  fs.readFile(path, function(err, file) {
    if (err) console.log('Couldn\'t read file', path, err)
    else cb(file.toString())
  })
}

function processFile(file, contents) {
  var pieces = extractTableCells(contents)
  var triples = cellsToTriples(pieces)
  var entries = triplesToEntries(triples, fileDate(file))
  var byPerson = _.groupBy(entries, 'who')
  var byPersonWeekdayStats = entryToStats(byPerson)
  return byPersonWeekdayStats;
}

function extractTableCells(html) {
  var $ = cheerio.load(html)
  return $('table tr').map(function(i, row) {
    return $(row).find('td').map(function(i, cell) {
      return $(cell).text().trim()
    }).get()
  }).get().slice(3)
}

function cellsToTriples(pieces) {
  var triples = [];
  for (var i = 0, len = pieces.length; i < len; i+=3) {
    triples.push([pieces[i], pieces[i+1], pieces[i+2]])
  }
  return triples
}

function triplesToEntries(triples, date) {
  var entries = [];
  for (var i = 0, len = triples.length; i < len; i++) {
    var dayDate = _.extend({}, date, {day: triples[i][0]})
    var col1 = triples[i][1];
    if (col1) entries.push(newEntry(dayDate, col1))
    // var col2 = pieces[i][2];
    // if (col2) entries.push(newEntry(dayDate, col2))
  }
  return entries
}

function newEntry(date, who) {
  return _.extend({}, date, {
    who: who,
    weekday: new Date(date.year, date.month-1, date.day).toString().split(' ')[0]
  });
}

function fileDate(file) {
  var fileParts = file.match(/([0-9]{4})-([0-9]{2})\.html$/)
  return {
    month: fileParts[2],
    year: fileParts[1]
  }
}

function entryToStats(entries) {
  return _.mapValues(entries, function(days) {
    return _.countBy(days, 'weekday')
  })
}

function mergeStats(x) {
  return _.merge(stats, x, function(a, b) {
    if (_.isArray(a)) return a.concat(b)
  });
}
