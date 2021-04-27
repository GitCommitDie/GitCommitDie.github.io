/**
 * This is what happens when you combine sleep deprivation, copious amounts of energy drinks, and not knowing how to code.
 *
 */
const urlParams = new URLSearchParams(window.location.search);

var settings = {
    advanced: true,
    dev: false,
    hideNSFW: true,
    defaultPageSize: 25,
};

var loadedItems = [];
var requestQueue = [];

var cachedItems = {
    all: [],
    valid: [],
    add(item) {
        if (this.all.every((x) => x._name != item._name)) {
            this.all.push(item);
            if (item._meta.valid) {
                this.valid.push(item);
            }
            return item;
        } else {
            return false;
        }
    },
    addAll(items) {
        returnedItems = [];
        for (let item of items) {
            item = this.add(item);
            if (item) returnedItems.add(item);
        }
        return returnedItems;
    },
    has(item) {
        return cachedItems.all.some((x) => x._name == item._name);
    },
    get shown() {
        return this.valid.filter((item) => item._meta.shown);
    },
    get hidden() {
        return this.valid.filter((item) => !item._meta.shown);
    },
};

function getVisibleLimit() {
    return (urlParams.get("limit") || settings.defaultPageSize) * gel("load-more-button").dataset.pageCount;
}

function appendItemProps(item, metadata) {
    item._kind = metadata.type == "comment" ? "t1" : "t3";
    item._type = metadata.type;
    item._name = item._kind + "_" + item.id;
    item._meta = metadata;
    if (!item.permalink) {
        if (item._type == "comment") {
            item.permalink = `/r/${item.subreddit}/comments/${item.link_id}/-/${item.id}/`;
        } else if (item._type == "submission") {
            item.permalink = `/r/${item.subreddit}/comments/${item.id}/-/`;
        }
    }
    return item;
}

function appendExtraProps(item) {
    if (!item._meta) {
        item = appendItemProps(item, metadata);
    }
    item._meta.state = "live";
    if (item.removed_by_category) {
        if (item.removed_by_category == "deleted") {
            item._meta.state = "deleted";
        } else {
            item._meta.state = "removed " + item.removed_by_category;
        }
    } else {
        if (item._kind == "t1") {
            if (item.author == "[deleted]" && item.body == "[removed]") {
                item._meta.state = "removed maybe";
            }
        }
    }
    if (item._meta.missing) {
        item._meta.state = "missing";
    }
    return item;
}

function getInfoTags(item) {
    return cel(
        "ul",
        [
            (item.name || item._name).startsWith("t1_")
                ? item.parent_id.startsWith("t1_")
                    ? celp("li", "C", { classList: "full-type", title: "Comment" })
                    : celp("li", "TC", { classList: "full-type", title: "Top-Level Comment" })
                : item.is_self
                ? celp("li", "TS", { classList: "full-type", title: "Self-Post Submission" })
                : item.is_video
                ? celp("li", "VS", { classList: "full-type", title: "Video Submission" })
                : item.is_gallery
                ? celp("li", "GS", { classList: "full-type", title: "Gallery Submission" })
                : item.is_poll
                ? celp("li", "PS", { classList: "full-type", title: "Poll Submission" })
                : item.url.match(/^https?:\/\/[iv]\.redd\.it\//)
                ? celp("li", "MS", { classList: "full-type", title: "Media Submission" })
                : celp("li", "LS", { classList: "full-type", title: "Link Submission" }),
            item.score != null
                ? celp("li", abbreviateNumber(item.score), {
                      classList: "score",
                      title: commaSeparateNumber(item.score) + " upvote" + (item.score != 1 ? "s" : ""),
                  })
                : null,
            item.all_awardings?.length
                ? celp("li", commaSeparateNumber(item.all_awardings.length), {
                      classList: "award-count",
                      title:
                          commaSeparateNumber(item.all_awardings.length) +
                          " award" +
                          (item.all_awardings.length != 1 ? "s" : ""),
                  })
                : null,
            item.num_comments != null
                ? celp("li", commaSeparateNumber(item.num_comments), {
                      classList: "comment-count",
                      title: commaSeparateNumber(item.num_comments) + " comment" + (item.num_comments != 1 ? "s" : ""),
                  })
                : null,
            item.over_18 ? cel("li", "NSFW", "tag nsfw") : null,
            item.spoiler ? cel("li", "Spoiler", "tag spoiler") : null,
            item.distinguished ? cel("li", "Distinguished", "tag distinguished") : null,
            item.stickied ? cel("li", cel("strong", "Stickied"), "tag stickied") : null,
            item.locked ? cel("li", "Locked", "tag locked") : null,
            item._meta.state == "deleted"
                ? cel("li", "Deleted", "tag deleted")
                : item._meta.state == "removed moderator"
                ? cel("li", "Removed by Moderator", "tag removed")
                : item._meta.state == "removed reddit"
                ? cel("li", "Removed by Reddit", "tag removed")
                : item._meta.state.startsWith("removed")
                ? cel("li", "Removed", "tag removed")
                : item._meta.state == "missing"
                ? celp("li", "Missing", { classList: "tag warn", title: "Item could not be found on Reddit." })
                : null,
        ],
        "info"
    );
}

function getContent(item) {
    if (item._kind == "t1") {
        return cel(
            "div",
            cel(
                "div",
                (function () {
                    let string = item.body_html
                        ? decodeHTML(item.body_html)
                        : SnuOwnd.getParser().render(decodeHTML(item.body));
                    if (urlParams.has("q")) {
                        for (let part of urlParams.get("q").split(/[^a-z0-9_.]/gi)) {
                            string = mdHighlight(string, "\\b" + part + "\\b");
                        }
                    }
                    return string;
                })(),
                "md"
            ),
            "content"
        );
    } else if (item._kind == "t3") {
        let empty = false;
        return cel(
            "div",
            (function () {
                try {
                    if (item.over_18 && settings.hideNSFW) {
                        return `<a href="${item.url}">[content hidden]</a>`;
                    }
                    if (item.is_self) {
                        empty = !item.selftext_html && !item.selftext;
                        return cel(
                            "div",
                            (function () {
                                let string = item.selftext_html
                                    ? decodeHTML(item.selftext_html)
                                    : SnuOwnd.getParser().render(decodeHTML(item.selftext));
                                if (urlParams.has("q")) {
                                    for (let part of urlParams.get("q").split(/[^a-z0-9_.]/gi)) {
                                        string = mdHighlight(string, "\\b" + part + "\\b");
                                    }
                                }
                                return string;
                            })(),
                            "md"
                        );
                    }
                    if (item.is_gallery) {
                        let gallery = cel("div", null, "gallery");
                        for (let gallery_item of item.gallery_data.items) {
                            let media_id = gallery_item.media_id;
                            let metadata = item.media_metadata[media_id];
                            let ext = metadata.m.split("/")[1];
                            gallery.appendChild(
                                celp("a", celp("img", null, { src: `https://i.redd.it/${media_id}.${ext}` }), {
                                    href: item.url,
                                    target: "_blank",
                                })
                            );
                        }
                        return gallery.outerHTML;
                    }
                    if (item.is_video) {
                        let s = `<video controls><source src="${item.media.reddit_video.fallback_url.split("?")[0]}"></video>`;
                        // s += `<audio controls><source src="${
                        //     item.media.reddit_video.fallback_url.replace(/DASH_[\w\d]+/, "DASH_audio").split("?")[0]
                        // }"></audio>`;
                        return s;
                    }
                    if (item.url.match(/\.(png|jpe?g|gif|webp|svg)$/)) {
                        return `<a href="${item.url}" target="_blank"><img src="${item.url}" alt="user generated image content"></a>`;
                    }
                    if (item.url.match(/\.(mp4|webm)$/)) {
                        let s = `<video controls><source src="${item.media.reddit_video.fallback_url}"></video>`;
                        // s += `<audio controls><source src="${item.media.reddit_video.fallback_url.replace(
                        //     /DASH_[\w\d]+/,
                        //     "DASH_audio"
                        // )}"></audio>`;
                        return s;
                    }
                } catch (error) {
                    console.warn(error);
                    return `<a href="${item.url}">${item.url}</a>`;
                }
                return `<a href="${item.url}">${item.url}</a>`;
            })(),
            "content " + (empty ? "empty" : "")
        );
    }
}

function getDisplayItem(item) {
    let displayItem = null;

    let attributes = [
        ["data-name", item._name],
        ["data-id", item.id],
        ["data-kind", item._kind],
        ["data-type", item._type],
        ["data-created-utc", item.created_utc],
        ["data-permalink", item.permalink],
        ["data-author", item.author],
        ["data-subreddit", item.subreddit],
    ];

    function getTagline() {
        return cel(
            "p",
            `${item._kind == "t3" ? "submitted" : "commented"} by <a href="https://www.reddit.com/user/${
                item.author
            }" class="author">u/${item.author}</a>` +
                (item.author_flair_text ? `<span class="flair">${item.author_flair_text}</span>` : "") +
                ` <time datetime="${new Date(item.created_utc * 1000).toString()}" title="${new Date(
                    item.created_utc * 1000
                ).toString()}" class="created-utc">${formatTime(
                    time() - item.created_utc
                )} ago</time> in <a href="https://www.reddit.com/r/${item.subreddit}">r/${item.subreddit}</a>`,
            "tagline"
        );
    }

    function getTitleContent() {
        return cel(
            "h1",
            `<a href="https://www.reddit.com${item.permalink}">${(function () {
                let string = item.title;
                if (urlParams.has("q")) {
                    for (let part of urlParams.get("q").split(/[^a-z0-9_.]/gi)) {
                        string = mdHighlight(string, "\\b" + part + "\\b");
                    }
                }
                return string;
            })()}</a>` + (item.link_flair_text ? `<span class="flair">${item.link_flair_text}</span>` : ""),
            "title"
        );
    }

    function getButtons() {
        return cel(
            "ul",
            [
                cel("li", `<a href="https://www.reddit.com${item.permalink}" target="_blank">view on reddit</a>`),
                cel("li", `<a href="https://www.removeddit.com${item.permalink}" target="_blank">view on removeddit</a>`),
                cel(
                    "li",
                    `<a href="https://api.pushshift.io/reddit/search/${item._type}/?ids=${item.id}" target="_blank">view on pushshift</a>`,
                    "advanced-option dev-option"
                ),
                cel(
                    "li",
                    `<a href="${item._meta.fetched_from}">Request: ${item._meta.request_id} • Item: ${
                        item._meta.sibling_position
                    }/${item._meta.sibling_count}${item._meta.refreshed ? " • Refreshed" : ""}</a>`,
                    "request-info advanced-option dev-option"
                ),
            ],
            "buttons"
        );
    }

    switch (item._kind) {
        case "t1":
            displayItem = celwa(
                "div",
                attributes,
                [
                    getTagline(),
                    getInfoTags(item),
                    getContent(item),
                    settings.advanced ? cel("div", [tableify({ properties: item })], "properties dev-option") : null,
                    getButtons(),
                ],
                ["item", "thing", "comment", item.removed_by_category == "deleted" ? "deleted" : null]
            );
            break;
        case "t3":
            let useThumbnail = item.thumbnail && item.thumbnail.match(/^https?:\/\//);
            if (!useThumbnail && item.url.match(/^https?:\/\/.+?\.(png|jpe?g|gif|webp)(\?.*)?/)) {
                item.thumbnail = item.url;
                useThumbnail = true;
            }
            if (useThumbnail) {
                if (item.over_18 && settings.hideNSFW) {
                    useThumbnail = false;
                }
            }
            displayItem = celwa(
                "div",
                attributes,
                [
                    celp(
                        "div",
                        [
                            celp("div", null, {
                                classList: "thumbnail " + (useThumbnail ? "image" : "default"),
                                style: useThumbnail ? 'background-image: url("' + item.thumbnail + '");' : "",
                                onclick(event) {
                                    if (displayItem.classList.contains("expanded")) {
                                        displayItem.classList.remove("expanded");
                                    } else {
                                        displayItem.classList.add("expanded");
                                    }
                                },
                            }),
                            cel("div", [getTitleContent(), getTagline(), getInfoTags(item)]),
                        ],
                        {
                            style: "display: inline-flex;",
                        }
                    ),
                    getContent(item),
                    settings.advanced ? cel("div", [tableify({ properties: item })], "properties dev-option") : null,
                    getButtons(),
                ],
                [
                    "item",
                    "thing",
                    "submission",
                    useThumbnail || (item.over_18 && settings.hideNSFW) ? "expandable" : null,
                    item.removed_by_category == "deleted" ? "deleted" : null,
                    item.is_self ? "self" : "link",
                    item.over_18 ? "nsfw" : null,
                    item._meta.missing ? "missing" : null,
                ]
            );
            break;
    }
    return displayItem;
}

function validateItem(item, params) {
    function checkExact() {
        let valid = true;
        if (urlParams.get("meta_search_exact") == "true") {
            if (item._kind == "t1") {
                valid = item.body.match(params.get("q"));
            } else if (item._kind == "t3") {
                valid =
                    item.title.match(params.get("q")) ||
                    (item.is_self && item.selftext && item.selftext.match(params.get("q")));
            }
        }
        return valid;
    }
    function filterPattern() {
        let valid = true;
        if (urlParams.get("meta_filter_pattern")) {
            if (item._kind == "t1") {
                valid = item.body.match(urlParams.get("meta_filter_pattern"));
            } else if (item._kind == "t3") {
                valid =
                    item.title.match(urlParams.get("meta_filter_pattern")) ||
                    (item.is_self && item.selftext && item.selftext.match(urlParams.get("meta_filter_pattern")));
            }
        }
        return valid;
    }
    function filterPatternSubreddit() {
        let valid = true;
        if (urlParams.get("meta_subreddit_filter_pattern")) {
            valid = item.subreddit.match(urlParams.get("meta_subreddit_filter_pattern"));
        }
        return valid;
    }
    function filterPatternAuthor() {
        let valid = true;
        if (urlParams.get("meta_author_filter_pattern")) {
            valid = item.author.match(urlParams.get("meta_author_filter_pattern"));
        }
        return valid;
    }
    function checkSearchFields() {
        let valid = true;
        if (urlParams.has("meta_search_fields")) {
            let fields = urlParams.get("meta_search_fields").split(/[,;&+ ]/g);
            let terms = params
                .get("q")
                .split(/[^a-z0-9_.]/g)
                .map((term) => "\\b" + term + "\\b");
            for (let field of fields) {
                if (item[field]) {
                    if (urlParams.get("meta_search_exact") == "true") {
                        valid = item[field].match(params.get("q"));
                    } else {
                        valid = terms.every((term) => item[field].match(term));
                    }
                }
            }
        }
        return valid;
    }
    function checkState() {
        let valid = true;
        if (urlParams.has("meta_state")) {
            valid = item._meta.state = urlParams.get("meta_state");
        }
        return valid;
    }
    return [
        checkExact,
        filterPattern,
        filterPatternSubreddit,
        filterPatternAuthor,
        checkSearchFields,
        checkState,
    ].every((check) => check());
}

async function fetchItems(endpoint, params) {
    params = new URLSearchParams(params.toString());

    let callParams = new URLSearchParams(params.toString());

    // if (callParams.has("limit")) {
    //     if (callParams.get("limit") != "none") {
    //         callParams.set("limit", Math.min(callParams.get("limit"), 100));
    //     } else {
    //         callParams.set("limit", 100);
    //     }
    // }

    // callParams.set(
    //     "limit",
    //     Math.min(
    //         Math.max((callParams.get("limit") != "none" ? callParams.get("limit") : 100) || settings.defaultPageSize + 10, 10),
    //         100
    //     )
    // ); // uh... idk.

    callParams.set("limit", 100);

    let fetchURL =
        `https://api.pushshift.io/reddit/search/${endpoint}/` + (callParams.toString() ? "?" + callParams.toString() : "");

    updateRequestTable(fetchURL, "pending");

    try {
        console.log("fetching " + fetchURL + "...");
        const response = await fetch(fetchURL);

        updateRequestTable(fetchURL, response.status);

        if (!response.ok) {
            throw "non-200 response status";
        }

        const data = await response.json();

        let items = data.data;

        let names = [];

        items.forEach((item) => {
            item = appendItemProps(item, {
                type: endpoint,
                fetched_from: fetchURL,
                request_id: qel("#request-table tbody").childElementCount,
                sibling_count: items.length,
                sibling_position: items.indexOf(item) + 1,
                valid: false,
                refreshed: false,
            });
            names.push(item._name);
        });

        let refreshURL = "https://api.reddit.com/api/info?id=" + names.join(",");

        console.log("fetching " + refreshURL + "...");
        const refresh_response = await fetch(refreshURL);
        const refresh_data = await refresh_response.json();

        for (let refreshed_item of refresh_data.data.children) {
            refreshed_item = refreshed_item.data;
            for (let item of items) {
                if (refreshed_item.name == item._name) {
                    for (const [key, value] of Object.entries(refreshed_item)) {
                        if (!["author", "selftext", "body", "selftext_html", "body_html"].includes(key)) {
                            item[key] = value;
                        }
                    }
                    item._meta.refreshed = true;
                    array_remove(names, item._name);
                    break;
                }
            }
        }

        for (let name of names) {
            for (let item of items) {
                if (name == item._name) {
                    item._meta.missing = true;
                    break;
                }
            }
        }

        for (let item of items) {
            item = appendExtraProps(item);
        }

        newItems = items.filter((item) => !cachedItems.has(item));

        for (let item of newItems) {
            if (cachedItems.valid.length >= 2000 || cachedItems.all.length >= 5000) throw "maximum item limit reached";
            item._meta.valid = validateItem(item, params);
            cachedItems.add(item);
        }

        if (
            // lol
            (params.get("limit") == "none" || cachedItems.valid.length < getVisibleLimit()) &&
            items.length == callParams.get("limit") &&
            newItems.length
        ) {
            if (params.has("sort") && params.get("sort") == "asc") {
                params.set("after", items[items.length - 1].created_utc - 1);
            } else {
                params.set("before", items[items.length - 1].created_utc + 1);
            }
            enqueue(endpoint, params);
        }
    } catch (error) {
        console.error(error);

        updateRequestTable(fetchURL, "failed");

        gel("banner").innerHTML = "Error Loading Items";
        gel("banner").classList.add("failed");

        throw error;
    }
}

function updateRequestTable(url, status) {
    function updateRow(statusText, statusClass = status) {
        let tableBody = gel("request-table").querySelector("tbody");
        let exists = false;
        for (let row of Array.from(tableBody.children)) {
            if (row.children[0].children[0].innerHTML.replace(/&amp;/g, "&") == url) {
                row.children[1].remove();
                row.insertBefore(cel("td", statusText, ["status", "status-" + statusClass]), row.lastChild);
                exists = true;
                break;
            }
        }

        if (!exists) {
            tableBody.appendChild(
                cel("tr", [
                    cel("td", celwa("a", [["href", url]], url)),
                    cel("td", statusText, ["status", "status-" + statusClass]),
                    cel("td", tableBody.childElementCount + 1),
                ])
            );
        }
    }

    if (status == "pending") {
        updateRow("Pending");
    } else if (status == "failed") {
        updateRow("Failed");
    } else {
        updateRow(status, status.toString()[0]);
    }
}

function enqueue(endpoint, params) {
    requestQueue.push([endpoint, params]);
}

function getTitle() {
    let title = "";
    if (urlParams.has("meta_type")) {
        let type = urlParams.get("meta_type");
        if (type == "submission") {
            title += "Submissions ";
        } else if (type == "comment") {
            title += "Comments ";
        } else {
            title += "Submissions and Comments ";
        }
    } else {
        title += "Submissions and Comments ";
    }

    if (urlParams.has("author")) {
        let authors = urlParams
            .get("author")
            .split(/[\s,+]/)
            .map((author) => "u/" + author);
        title += "by " + authors.join(" or ") + " ";
    }

    if (urlParams.has("subreddit")) {
        let subreddits = urlParams
            .get("subreddit")
            .split(/[\s,+]/)
            .map((subreddit) => "r/" + subreddit);
        title += "in " + subreddits.join(" or ") + " ";
    }

    if (urlParams.has("q")) {
        title += 'Matching "' + urlParams.get("q") + '"';
    }

    return title + " - Coddit ReSearch Results";
}

async function processQueue() {
    document.title = "Search Results - Coddit ReSearch";

    gel("items-panel").classList.remove("collapsed");

    gel("parameters-panel").classList.add("collapsed");

    gel("banner").innerHTML =
        '<img class="loading-icon" src="/search/static/CGH1e.png" style="height: 2em; vertical-align: middle; margin-bottom: 2px;">';
    gel("banner").hidden = false;

    while ((nextRequest = requestQueue.shift())) {
        let request = nextRequest;

        await fetchItems(request[0], request[1]);

        sortItems();

        if (requestQueue.length == 0) {
            if (cachedItems.valid.length) {
                gel("banner").hidden = true;
                if (!request[1].has("ids") && cachedItems.valid.length >= getVisibleLimit()) {
                    gel("load-more-button").hidden = false;
                }
            } else {
                if (!gel("banner").classList.contains("failed")) gel("banner").innerHTML = "No Data";
            }
            showItems();
            updateInfo();
        }

        await sleep(1000);
    }
}

function sortItems() {
    cachedItems.valid.sort((a, b) => {
        if (urlParams.has("sort") && urlParams.get("sort") == "asc") {
            return a.created_utc > b.created_utc ? 1 : b.created_utc > a.created_utc ? -1 : 0;
        } else {
            return a.created_utc < b.created_utc ? 1 : b.created_utc < a.created_utc ? -1 : 0;
        }
    });
    // if (urlParams.has("limit")) {
    //     if (urlParams.get("limit") != "none") {
    //         cachedItems.valid = cachedItems.valid.slice(0, urlParams.get("limit") * gel("load-more-button").dataset.pageCount);
    //     }
    // } else {
    //     cachedItems.valid = cachedItems.valid.slice(0, settings.defaultPageSize * gel("load-more-button").dataset.pageCount);
    // }
}

function showItems() {
    let itemsContainer = gel("items");
    // itemsContainer.innerHTML = "";
    for (let i = 0; i < cachedItems.valid.length; i++) {
        let item = cachedItems.valid[i];
        if (i > getVisibleLimit() - 1) {
            break;
        }
        if (item._meta.shown) {
            continue;
        }
        item._meta.shown = true;
        try {
            itemsContainer.appendChild(getDisplayItem(item));
        } catch (error) {
            console.error(`failed to show item ${item._name}`);
            console.error(error);
        }
        gel("item-count").innerHTML = itemsContainer.childElementCount;
    }
}

function updateInfo() {
    let info = gel("info");
    info.innerHTML = "";

    let subreddits = [];
    let authors = [];
    let submissions_count = 0;
    let comments_count = 0;

    for (let item of cachedItems.shown) {
        let subreddit = subreddits.find((element) => element.name == item.subreddit);
        if (!subreddit) {
            subreddit = { name: item.subreddit, contributions: 0, submissions: 0, comments: 0 };
            subreddits.push(subreddit);
        }

        let author = authors.find((element) => element.name == item.author);
        if (author) {
            author.count += 1;
        } else {
            author = { name: item.author, contributions: 0, submissions: 0, comments: 0 };
            authors.push(author);
        }

        subreddit.contributions += 1;
        author.contributions += 1;

        if (item._type == "submission") {
            subreddit.submissions += 1;
            author.submissions += 1;
            submissions_count += 1;
        } else {
            subreddit.comments += 1;
            author.comments += 1;
            comments_count += 1;
        }
    }

    subreddits.sort((a, b) => (a.contributions < b.contributions ? 1 : b.contributions < a.contributions ? -1 : 0));
    authors.sort((a, b) => (a.contributions < b.contributions ? 1 : b.contributions < a.contributions ? -1 : 0));

    Array.from(gel("items").children).forEach((item) => {
        item.classList.remove("user-hidden-subreddit");
        item.classList.remove("user-hidden-author");
    });

    info.appendChild(
        cel(
            "div",
            cel("table", [
                cel("caption", "General"),
                cel("thead", cel("tr", [cel("th", "Total Items"), cel("th", "Submissions"), cel("th", "Comments")])),
                cel("tbody", [
                    cel("tr", [
                        cel("td", cachedItems.shown.length, "center"),
                        cel("td", submissions_count, "center"),
                        cel("td", comments_count, "center"),
                    ]),
                ]),
            ])
        )
    );

    function getListToggleButton(tbody, value, className, property) {
        return celp("a", value, {
            href: "javascript:void(0);",
            onclick(event) {
                function getSelectedCount() {
                    return Array.from(tbody.children).filter((element) => !element.classList.contains(className)).length;
                }
                let parentRow = event.target.parentElement.parentElement;
                if (event.ctrlKey || event.shiftKey) {
                    if (parentRow.classList.contains(className)) {
                        parentRow.classList.remove(className);
                    } else {
                        parentRow.classList.add(className);
                    }
                } else {
                    if (!parentRow.classList.contains(className) && getSelectedCount() == 1) {
                        for (let row of tbody.children) {
                            row.classList.remove(className);
                        }
                    } else {
                        for (let row of tbody.children) {
                            row.classList.add(className);
                        }
                        parentRow.classList.remove(className);
                    }
                }
                if (getSelectedCount() == 0) {
                    for (let row of tbody.children) {
                        row.classList.remove(className);
                    }
                }
                for (let thing of gel("items").children) {
                    thing.classList.add(className);
                    for (let row of tbody.children) {
                        if (
                            !row.classList.contains(className) &&
                            thing.dataset[property] == row.querySelector("td:first-of-type a").innerHTML
                        ) {
                            thing.classList.remove(className);
                        }
                    }
                }
                // gel("info-panel").scrollIntoView({ block: "start" });
            },
        });
    }

    info.appendChild(
        cel("table", [
            cel("caption", "Subreddits • " + subreddits.length),
            cel("thead", [cel("tr", [cel("th", "Subreddit"), cel("th", "Total"), cel("th", "Subs"), cel("th", "Coms")])]),
            (function () {
                let tbody = cel("tbody");
                for (let subreddit of subreddits) {
                    tbody.appendChild(
                        cel("tr", [
                            cel("td", getListToggleButton(tbody, subreddit.name, "user-hidden-subreddit", "subreddit")),
                            cel("td", subreddit.contributions, "center"),
                            cel("td", subreddit.submissions, "center"),
                            cel("td", subreddit.comments, "center"),
                        ])
                    );
                    if (tbody.childElementCount > 24) {
                        tbody.appendChild(
                            cel("tr", [
                                cel("td", "<a>...</a>"),
                                cel("td", "<a>...</a>", "center"),
                                cel("td", "<a>...</a>", "center"),
                                cel("td", "<a>...</a>", "center"),
                            ])
                        );
                        break;
                    }
                }
                return tbody;
            })(),
        ])
    );

    info.appendChild(
        cel("table", [
            cel("caption", "Authors • " + authors.length),
            cel("thead", [cel("tr", [cel("th", "Author"), cel("th", "Total"), cel("th", "Subs"), cel("th", "Coms")])]),
            (function () {
                let tbody = cel("tbody");
                for (let author of authors) {
                    tbody.appendChild(
                        cel("tr", [
                            cel("td", getListToggleButton(tbody, author.name, "user-hidden-author", "author")),
                            cel("td", author.contributions, "center"),
                            cel("td", author.submissions, "center"),
                            cel("td", author.comments, "center"),
                        ])
                    );
                    if (tbody.childElementCount > 24) {
                        tbody.appendChild(
                            cel("tr", [
                                cel("td", "<a>...</a>"),
                                cel("td", "<a>...</a>", "center"),
                                cel("td", "<a>...</a>", "center"),
                                cel("td", "<a>...</a>", "center"),
                            ])
                        );
                        break;
                    }
                }
                return tbody;
            })(),
        ])
    );

    gel("info-panel").classList.remove("collapsed");
}

for (let [key, value] of Object.entries(getCookies())) {
    if (!key.startsWith("setting_")) continue;
    if (value.match(/^(true|false)$/)) value = value == "true";
    else if (parseInt(value) || value == 0) value = parseInt(value);
    settings[key.replace(/^setting_/, "")] = value;
}

if (settings.advanced) {
    document.body.classList.add("setting-advanced");
} else {
    gels("advanced-option").forEach((element) => {
        element.hidden = true;
    });
    qels(".advanced-option input, .advanced-option select").forEach((element) => {
        element.disabled = true;
    });
}

if (settings.dev) {
    document.body.classList.add("setting-dev");
}

gel("parameter-meta_type").onchange = (event) => {
    gels("comments-only").forEach((element) => (element.disabled = false));
    gels("submissions-only").forEach((element) => (element.disabled = false));
    if (event.target.value == "submission") {
        gels("comments-only").forEach((element) => (element.disabled = true));
    } else if (event.target.value == "comment") {
        gels("submissions-only").forEach((element) => (element.disabled = true));
    }
};

gel("request-form").onsubmit = (event) => {
    Array.from(event.target.querySelectorAll("input, select")).forEach((element) => {
        if (!element.value || element.value == element.dataset.defaultValue) {
            element.name = "";
        }

        if (element.name.match(/\[\]$/)) {
            element.name = element.name.substring(0, element.name.length - 2);
            for (const part of element.value.split(/;/g)) {
                event.target.appendChild(celfs(`<input type="hidden" name="${element.name}" value="${part}">`));
            }
            element.name = "";
            element.disabled = true;
        }
    });
};

qels("input[type='checkbox']").forEach((element) => {
    element.value = element.checked;
    element.addEventListener("change", () => {
        element.value = element.checked;
    });
});

qels(".panel-header").forEach((element) => {
    element.onclick = () => {
        let parent = element.parentElement;

        if (parent.classList.contains("collapsed")) {
            parent.classList.remove("collapsed");
        } else {
            parent.classList.add("collapsed");
        }
    };
});

qels(".panel").forEach((element) => {
    element.addEventListener("click", (event) => {
        if (event.target.classList.contains("collapsed")) {
            event.target.classList.remove("collapsed");
        }
    });
});

gel("download-button").onclick = () => {
    downloadText(JSON.stringify({ items: cachedItems.valid }, null, 4), "data.json");
};

if (window.location.href.split("?").length > 1) {
    let params = new URLSearchParams(window.location.search);

    let type = "any";

    if (params.has("meta_type")) {
        type = params.get("meta_type");
    }

    qels("#request-form input, #request-form select").forEach((element) => {
        let eqvParam = element.id.replace(/^parameter-/, "");
        if (params.has(eqvParam)) {
            if (element.name.match(/\[\]$/)) {
                element.value = "";
                for (const [key, value] of params.entries()) {
                    if (key == element.id.replace(/^parameter-/, "")) {
                        element.value += value + ";";
                    }
                }
                element.value = element.value.substring(0, element.value.length - 1);
            } else {
                if (element.type == "checkbox") {
                    element.checked = params.get(eqvParam) == "true";
                } else {
                    element.value = params.get(eqvParam);
                }
            }
        }
    });

    ["before", "after"].forEach((parameter) => {
        if (params.has(parameter) && params.get(parameter).match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            params.set(parameter, Date.parse(params.get(parameter)) / 1000);
        }
    });

    let queryParams = new URLSearchParams(
        [...params.entries()]
            .filter((param) => param[1] && !param[0].startsWith("meta_"))
            .reduce((x, y) => {
                return x + y[0] + "=" + encodeURIComponent(y[1]) + "&";
            }, "?")
    );

    if (queryParams.has("q")) {
        // i have no idea lmaoooooooooooooooooooooooooo
        for (let term of queryParams.get("q").split("|")) {
            queryTermParams = new URLSearchParams(queryParams.toString());
            queryTermParams.set("q", term);
            if (type == "any") {
                enqueue("submission", queryTermParams);
                enqueue("comment", queryTermParams);
            } else {
                enqueue(type, queryTermParams);
            }
        }
    } else {
        if (type == "any") {
            enqueue("submission", queryParams);
            enqueue("comment", queryParams);
        } else {
            enqueue(type, queryParams);
        }
    }

    processQueue();

    gel("load-more-button").innerHTML = "Load " + (queryParams.get("sort") == "asc" ? "After" : "Before");

    gel("load-more-button").onclick = (event) => {
        event.target.hidden = true;

        event.target.dataset.pageCount = parseInt(event.target.dataset.pageCount) + 1;

        let lastItem = cachedItems.valid[cachedItems.valid.length - 1];

        // urlParams.set("meta_pages", urlParams.has("meta_pages") ? parseInt(urlParams.get("meta_pages")) + 1 : 2);
        // window.history.pushState({}, document.title, window.location.href.split("?")[0] + "?" + urlParams.toString());

        if (cachedItems.valid.length < getVisibleLimit() * (type == "any" ? 2 : 1)) {
            if (queryParams.get("sort") == "asc") {
                queryParams.set("after", lastItem.created_utc - 1);
                queryParams.delete("before");
            } else {
                queryParams.set("before", lastItem.created_utc + 1);
                queryParams.delete("after");
            }

            if (queryParams.has("q")) {
                for (let term of queryParams.get("q").split("|")) {
                    queryTermParams = new URLSearchParams(queryParams.toString());
                    queryTermParams.set("q", term);
                    if (type == "any") {
                        enqueue("submission", queryTermParams);
                        enqueue("comment", queryTermParams);
                    } else {
                        enqueue(type, queryTermParams);
                    }
                }
            } else {
                if (type == "any") {
                    enqueue("submission", queryParams);
                    enqueue("comment", queryParams);
                } else {
                    enqueue(type, queryParams);
                }
            }

            processQueue();
        } else {
            showItems();
            updateInfo();
            if (!urlParams.has("ids") && cachedItems.valid.length >= getVisibleLimit()) {
                gel("load-more-button").hidden = false;
            }
        }
    };
}

qels("[data-dependent-on]").forEach((element) => {
    let dependencyRequirements = element.dataset.dependentOn.split("=");
    let dependentInput = gel(dependencyRequirements[0]);
    let requiredValue = dependencyRequirements.slice(1).join("");

    function disabledCheck() {
        element.disabled = requiredValue ? !dependentInput.value.match(requiredValue) : !dependentInput.value;
    }

    disabledCheck();

    if (dependentInput.tagName == "SELECT") {
        dependentInput.addEventListener("change", () => {
            disabledCheck();
        });
    } else if (dependentInput.tagName == "INPUT") {
        switch (dependentInput.type) {
            case "checkbox":
                dependentInput.addEventListener("change", () => {
                    disabledCheck();
                });
                break;
            case "text":
            case "search":
            case "password":
                dependentInput.addEventListener("keyup", () => {
                    disabledCheck();
                });
                break;
        }
    }
});
