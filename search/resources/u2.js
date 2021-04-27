function round(x, places = 2) {
    return Math.round((x + Number.EPSILON) * parseInt("1" + "0".repeat(places))) / parseInt("1" + "0".repeat(places));
}

function decodeHTML(string) {
    return new DOMParser().parseFromString(string, "text/html").documentElement.textContent;
}

function formatTime(time, options) {
    time = parseInt(time);
    let unit = "second";
    for (let timeUnit of [
        ["year", 31556926],
        ["month", 2629743],
        ["week", 604800],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60],
    ]) {
        if (time > timeUnit[1]) {
            time = options && options.useDecimal ? round(time / timeUnit[1]) : Math.floor(time / timeUnit[1]);
            unit = timeUnit[0];
            break;
        }
    }
    return `${time} ${unit + (time != 1 ? "s" : "")}`;
}

function abbreviateNumber(number) {
    let abbreviated = number;
    if (number > 1000) {
        abbreviated = round(number / 1000, 1) + "k";
    }
    return abbreviated;
}

function commaSeparateNumber(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function mdHighlight(string, regex) {
    try {
        string = string.replace(
            new RegExp("(?<!<[^<>]+?)(" + regex + ")(?![^<>]+?>)", "gi"),
            '<span class="highlighted">$1</span>'
        );
    } catch (error) {
        console.error(error);
        string = string.replace(new RegExp("(" + regex + ")", "gi"), '<span class="highlighted">$1</span>');
    }
    return string;
}

function mdParseBasic(string) {
    string = string.replace(/((?:(?:^&gt;[^\n]*)(?:\n+(?=&gt;))?)+)/gm, "<blockquote>\n$1\n</blockquote>");
    string = string.replace(/^&gt;\s*/gm, "");

    string = string.replace(/((?:(?:^ {4}[^\n]*)(?:\n+(?= {4}))?)+)/gm, "<pre><code>$1</code></pre>");
    string = string.replace(/^(<pre><code>)? {4}/gm, "$1<!-- CODE_LINE -->");

    string = string.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    string = string.replace(/\*(.+?)\*/g, "<em>$1</em>");

    string = string.replace(/~~(.+?)~~/g, "<del>$1</del>");

    string = string.replace(/`(.+?)`/g, "<code>$1</code>");

    string = string.replace(/^[-+*]\s+(.+?)$/gm, "<!-- UL_ITEM --><li>$1</li>");
    string = string.replace(/((?:(?:<!-- UL_ITEM --><li>[^\n]*)(?:\n+(?=<!-- UL_ITEM -->))?)+)/g, "<ul>\n$1\n</ul>");

    string = string.replace(/^\d+\.\s+(.+?)$/gm, "<!-- OL_ITEM --><li>$1</li>");
    string = string.replace(/((?:(?:<!-- OL_ITEM --><li>[^\n]*)(?:\n+(?=<!-- OL_ITEM -->))?)+)/g, "<ol>\n$1\n</ol>");

    string = string.replace(/^(?:-{3,}|_{3,}|\*{3,}|~{3,}|={3,}|\+{3,})$/gm, "<hr>");

    string = string.replace(/^######\s*(.+)$/gm, "<h6>$1</h6>");
    string = string.replace(/^#####\s*(.+)$/gm, "<h5>$1</h5>");
    string = string.replace(/^####\s*(.+)$/gm, "<h4>$1</h4>");
    string = string.replace(/^###\s*(.+)$/gm, "<h3>$1</h4>");
    string = string.replace(/^##\s*(.+)$/gm, "<h2>$1</h2>");
    string = string.replace(/^#\s*(.+)$/gm, "<h1>$1</h1>");

    string = string.replace(/\^\((.+?)\)/g, "<sup>$1</sup>");
    string = string.replace(/\^([^\s\^]+)/g, "<sup>$1</sup>");

    string = string.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    string = string.replace(/(^|\s)\/?([ru]\/[a-z0-9\/_.-]+)/gim, '$1<a href="https://www.reddit.com/$2">$2</a>');

    string = string.replace(/(^|\s)(https?:\/\/\S+)/gim, '$1<a href="$2">$2</a>');

    // string = string.replace(/(https?:\/\/[^\s.,?!]+)/g, '<a href="$1">$1</a>');

    string = string.replace(/^((?:.+?\|)+.+)$/gm, "<tr><td>$1</td></tr>");
    string = string.replace(/^<tr><td>(.+?)<\/td><\/tr>/gm, function (match, p1) {
        let s = "";
        p1.split("|").forEach((s1) => (s += "<td>" + s1 + "</td>"));
        return "<tr>" + s + "</tr>";
    });
    string = string.replace(/((?:^<tr>.+?<\/tr>(\n(?=<tr>))?)+)/gm, "<table>\n<tbody>\n$1\n</tbody>\n</table>");
    string = string.replace(/<tbody>\n(<tr>.+?<\/tr>)\n<tr>.+?<\/tr>/gm, "<thead>\n$1\n</thead>\n<tbody>");
    string = string.replace(/^<thead>\n.+?\n<\/thead>/gm, function (match) {
        return match.replace(/<td>/g, "<th>").replace(/<\/td>/g, "</th>");
    });

    string = string.replace(
        /^(?!<\/?(?:!--|(?:blockquote|codeblock|code|pre|h[123456r]|li|[uo]l|t[rd]|table|thead|tbody)>))(.+?)$/gm,
        "<p>\n$1\n</p>"
    );

    string = string.replace(/^(.+?) {2,}$/gm, "$1\n<br>\n");

    string = string.replace(/\n+/g, "\n");

    string = string.replace(/\\/g, "");

    string = string.replace(/<!-- .+? -->/g, "");

    string = string.replace(/&amp;/g, "&").replace(/&nbsp;/g, "\u00a0");

    return string;
}

// function mdParseBasic(string) {
//     if (!string) return string;

//     try {
//         // string = string.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

//         string = string.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
//         string = string.replace(/\*(.+?)\*/g, "<em>$1</em>");

//         string = string.replace(new RegExp("(?<![\\[\\(])(https?:\\/\\/\\S+)(?![\\]\\)])", "g"), `<a href="$1">$1</a>`);

//         string = string.replace(/\[(.+?)\]\((.+?)\)/g, `<a href="$2">$1</a>`);

//         string = string.replace(/(^(&gt;[^\n]+)\n?)+/gm, `\n<blockquote>\n$1\n</blockquote>\n`);
//         string = string.replace(/^&gt;/gm, "");

//         string = string.replace(/^-{3,}$/gm, "<hr>");

//         string = string.replace(/^######\s*?(.+)$/gm, "<h6>$1</h6>");
//         string = string.replace(/^#####\s*?(.+)$/gm, "<h5>$1</h5>");
//         string = string.replace(/^####\s*?(.+)$/gm, "<h4>$1</h4>");
//         string = string.replace(/^###\s*?(.+)$/gm, "<h3>$1</h4>");
//         string = string.replace(/^##\s*?(.+)$/gm, "<h2>$1</h2>");
//         string = string.replace(/^#\s*?(.+)$/gm, "<h1>$1</h1>");

//         string = string.replace(new RegExp("(?<!\\n)\\n(?!\\n)", "g"), "");
//         string = string.replace(/^(.+)$/gm, "<p>\n$1\n</p>");
//     } catch (error) {
//         console.error(error);
//         string = string.replace("\n", "<br>");
//     }

//     return string;
// }
