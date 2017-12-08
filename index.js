"use strict";

const PEG = require("pegjs");
const fs = require("fs");
const path = require("path");

const antlr4 = require("antlr4");
const SolidityLexer = require("./antlr/SolidityLexer").SolidityLexer;
const SolidityParser = require("./antlr/SolidityParser").SolidityParser;

const builtParsers = {
    "solidity": require("./build/parser"),
    "imports": require("./build/imports_parser")
};


function parseComments(code) {
    const chars = new antlr4.InputStream(code);
    const lexer = new SolidityLexer(chars);
    const tokens  = new antlr4.CommonTokenStream(lexer);
    const parser = new SolidityParser(tokens);

    parser.buildParseTrees = true;
    parser.sourceUnit();

    let comments = tokens.filterForChannel(0, tokens.tokens.length - 1, 1); // 1 is id of channel "HIDDEN"

    comments = comments.map(c => {
        const commentTypes = {118: "BlockComment", 119: "LineComment"};
        const {start, stop, line, column, text} = c;

        return {
            type: commentTypes[c.type],
            start,
            end: stop,
            line,
            column,
            text
        };
    });

    return comments;
}


// TODO: Make all this async.
module.exports = {
    getParser: function(parser_name, rebuild) {
        if (rebuild == true) {
            let parserfile = fs.readFileSync(path.resolve("./" + parser_name + ".pegjs"), {encoding: "utf8"});
            return PEG.generate(parserfile);
        } else {
            return builtParsers[parser_name];
        }
    },
    parse: function(source, options, parser_name, rebuild) {
        if (typeof parser_name == "boolean") {
            rebuild = parser_name;
            parser_name = null;
        }

        if (parser_name == null) {
            parser_name = "solidity";
        }

        let parser = this.getParser(parser_name, rebuild);
        let result;

        try {
            result = parser.parse(source);
        } catch (e) {
            if (e instanceof parser.SyntaxError) {
                e.message += " Line: " + e.location.start.line + ", Column: " + e.location.start.column;
            }
            throw e;
        }

        if (typeof options === "object" && options.comment === true) {
            result.comments = parseComments(source);
        }

        return result;
    },
    parseFile: function(file, parser_name, rebuild) {
        return this.parse(fs.readFileSync(path.resolve(file), {encoding: "utf8"}), parser_name, rebuild);
    },
    parseComments
};
