const fs = require("fs");
const { parse } = require("csv-parse");

var substs = [
    { find: "\\\\u2014", replace: "-" },
    { find: "\\\\u2026", replace: "…" },
    { find: "\\\\u2019", replace: "" },
    { find: "\\\\u2502", replace: "│" },
];

function wouldElide(str) {
    return str.includes(":");
}

function elideKey(key) {
    return key.replaceAll(":", "");
}

function cleanupSpanishValue(val) {
    if (val.endsWith(" \\")) {
        val = val.slice(0, -2);
    }
    if (val.endsWith("\\")) {
        val = val.slice(0, -1);
    }
    for (let i = 0; i < substs.length; i++) {
        val = val.replaceAll(substs[i].find, substs[i].replace);
    }
    return val;
}

function writeOutput(spnMap) {
    var outstr = "";
    var keys = Object.keys(spnMap).sort();
    for (let i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (spnMap.hasOwnProperty(key)) {
            outstr += key + "," + '"' + spnMap[key] + '"' + "\n";
        }
    }

    fs.writeFile("./SpanishOutput.csv", outstr, (err) => {
        if (err) {
            console.log(err);
        }
    });
}

var keyMap = {};
fs.createReadStream("./MavenEnglish.csv")
    .pipe(parse({ delimiter: ",", from_line: 1 }))
    .on("data", function (row) {
        if (row.length === 2) {
            if (keyMap.hasOwnProperty(row[0])) {
                console.log("Duplicate key: ", row);
            } else {
                keyMap[row[0]] = row[1];
            }
        }
    })
    .on("error", (err) => {
        console.log("Error: ", err);
    })
    .on("end", (rowCount) => {
        var elidedMap = {};
        for (const key in keyMap) {
            if (keyMap.hasOwnProperty(key) && wouldElide(key)) {
                var elidedKey = elideKey(key);
                if (elidedMap.hasOwnProperty(elidedKey)) {
                    console.log(`Duplicate elided keys: (${key})`, elidedKey);
                } else if (keyMap.hasOwnProperty(elidedKey)) {
                    console.log("Elided key collision: ", elidedKey);
                } else {
                    elidedMap[elidedKey] = key;
                }
            }
        }

        var spanishMap = {};
        fs.createReadStream("./MavenSpanish.csv")
            .pipe(parse({ delimiter: ",", from_line: 2 }))
            .on("data", function (row) {
                if (row.length > 2) {
                    var spanishKey = row[0];
                    var spanishValue = cleanupSpanishValue(row[2]);
                    console.log(spanishKey);
                    if (keyMap.hasOwnProperty(spanishKey)) {
                        if (spanishMap.hasOwnProperty(spanishKey)) {
                            console.log("Spanish duplicate key: ", row);
                        } else {
                            spanishMap[spanishKey] = spanishValue;
                        }
                    } else {
                        var elidedKey = elideKey(spanishKey);
                        if (!elidedMap.hasOwnProperty(elidedKey)) {
                            console.log("Unknown Spanish key: ", spanishKey);
                        } else {
                            var origKey = elidedMap[spanishKey];
                            spanishMap[origKey] = spanishValue;
                        }
                    }
                }
            })
            .on("end", (spanishRowCount) => {
                writeOutput(spanishMap);
            });
    });
