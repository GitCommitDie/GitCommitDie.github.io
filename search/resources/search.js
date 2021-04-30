/**
 * This is what happens when you combine sleep deprivation, copious amounts of energy drinks, and not knowing how to code.
 *
 */

fetch(`https://coddit.xyz/api/analytics/ping?u=${encodeURIComponent(window.location.href)}`)
    .then((res) => res.json())
    .then((data) => {
        if (data.status != "OK") console.warn("coddit API may be having issues");
    });

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
    if (item.fullname) {
        item.id = item.fullname.split("_")[1];
    }
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
            if (
                (item.author == "[deleted]" && item.body == "[removed]") ||
                (item._refreshed_properties &&
                    item._refreshed_properties.author == "[deleted]" &&
                    item._refreshed_properties.body == "[removed]")
            ) {
                item._meta.state = "removed maybe";
            } else if (
                item.author == "[deleted]" ||
                (item._refreshed_properties && item._refreshed_properties.author == "[deleted]")
            ) {
                item._meta.state = "deleted";
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
                    ? celp("li", "C", { classList: "full-type", title: "Comment Reply" })
                    : celp("li", "TC", { classList: "full-type", title: "Top-Level Comment" })
                : item.is_self
                ? celp("li", "TS", { classList: "full-type", title: "Self-Post Submission" })
                : item.is_video
                ? celp("li", "VS", { classList: "full-type", title: "Video Submission" })
                : item.is_gallery
                ? celp("li", "GS", { classList: "full-type", title: "Gallery Submission" })
                : item.poll_data
                ? celp("li", "PS", { classList: "full-type", title: "Poll Submission" })
                : item.url.match(/^https?:\/\/[iv]\.redd\.it\//)
                ? celp("li", "MS", { classList: "full-type", title: "Media Submission" })
                : celp("li", "LS", { classList: "full-type", title: "Link Submission" }),
            item.score != null
                ? celp("li", abbreviateNumber(item.score), {
                      classList: "score",
                      title: commaSeparateNumber(item.score) + " Upvote" + (item.score != 1 ? "s" : ""),
                  })
                : null,
            item.all_awardings && item.all_awardings.length // item.all_awardings?.length
                ? celp("li", commaSeparateNumber(item.all_awardings.length), {
                      classList: "award-count",
                      title:
                          commaSeparateNumber(item.all_awardings.length) +
                          " Award" +
                          (item.all_awardings.length != 1 ? "s" : ""),
                  })
                : null,
            item.num_comments != null
                ? celp("li", commaSeparateNumber(item.num_comments), {
                      classList: "comment-count",
                      title: commaSeparateNumber(item.num_comments) + " Comment" + (item.num_comments != 1 ? "s" : ""),
                  })
                : null,
            item.over_18 ? celp("li", "NSFW", { classList: "tag nsfw", title: "Tagged as NSFW" }) : null,
            item.spoiler ? celp("li", "Spoiler", { classList: "tag spoiler", title: "Tagged as Spoiler" }) : null,
            item.distinguished
                ? celp("li", "Distinguished", {
                      classList: "tag distinguished " + item.distinguished,
                      title: "Distinguished as " + item.distinguished.charAt(0).toUpperCase() + item.distinguished.slice(1),
                  })
                : null,
            item.stickied ? celp("li", "Stickied", { classList: "tag stickied", title: "Pinned by Moderator" }) : null,
            item.locked ? celp("li", "Locked", { classList: "tag locked", title: "Locked by Moderator" }) : null,
            item._meta.state == "deleted"
                ? celp("li", "Deleted", { classList: "tag deleted", title: "Deleted by Author" })
                : item._meta.state == "removed moderator"
                ? celp("li", "Removed by Moderator", {
                      classList: "tag removed moderator",
                      title: "Removed by Subreddit Moderator",
                  })
                : item._meta.state == "removed reddit"
                ? celp("li", "Removed by Reddit", { classList: "tag removed reddit", title: "Removed by Reddit" })
                : item._meta.state.startsWith("removed")
                ? celp("li", "Removed", { classList: "tag removed", title: "Removed" })
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
                    } else if (item.is_self) {
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
                    } else if (item.is_gallery) {
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
                    } else if (item.is_video && item.media.reddit_video.fallback_url) {
                        // let mergedUrl =
                        //     "https://coddit.xyz/api/ffmpeg/merge?video=" +
                        //     item.media.reddit_video.fallback_url +
                        //     "&audio=" +
                        //     item.media.reddit_video.fallback_url.replace(/DASH_[\w\d]+/, "DASH_audio");
                        let s = `<video controls><source src="${item.media.reddit_video.fallback_url}"></video>`;
                        return s;
                    } else if (item.url.match(/\.(png|jpe?g|gif|webp|svg)$/)) {
                        return `<a href="${item.url}" target="_blank"><img src="${item.url}" alt="user generated image content"></a>`;
                    } else if (item.url.match(/\.(mp4|mov|webm)$/)) {
                        return `<video controls><source src="${item.url}"></video>`;
                    } else if (item.url.match(/\.(mp3|wav)$/)) {
                        return `<audio controls><source src="${item.url}"></audio>`;
                    }
                } catch (error) {
                    console.warn(error);
                    return `<a href="${item.url}">${item.url}</a>`;
                }
                return `<a href="${item.url}">${item.url}</a>`;
            })(),
            ["content", empty ? "empty" : null]
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
            })()}</a>` +
                (item.link_flair_text ? `<span class="flair">${item.link_flair_text}</span>` : "") +
                (item.domain
                    ? `<a href="https://www.reddit.com/domain/${item.domain}/" class="domain">(${item.domain})</a>`
                    : ""),
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
                    settings.advanced
                        ? cel(
                              "div",
                              [tableify_v2({ properties: item }, { usePlaceholders: true, sort: true })],
                              "properties dev-option"
                          )
                        : null,
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
                            classList: "entry",
                        }
                    ),
                    getContent(item),
                    settings.advanced
                        ? cel(
                              "div",
                              [tableify_v2({ properties: item }, { usePlaceholders: true, sort: true })],
                              "properties dev-option"
                          )
                        : null,
                    getButtons(),
                ],
                [
                    "item",
                    "thing",
                    "submission",
                    item.is_self ? null : "expandable",
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
            valid = urlParams.get("meta_state").split(/[,+ ]/).includes(item._meta.state);
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

async function getAccessToken() {
    let existingToken = window.sessionStorage.getItem("reddit_access_token")
        ? JSON.parse(window.sessionStorage.getItem("reddit_access_token"))
        : null;
    if (!existingToken || existingToken.expires_at <= time()) {
        console.log("fetching access token...");
        const auth_response = await fetch("https://www.reddit.com/api/v1/access_token", {
            method: "POST",
            body: "grant_type=https://oauth.reddit.com/grants/installed_client&device_id=DO_NOT_TRACK_THIS_DEVICE",
            headers: {
                Authorization: "Basic " + btoa("RiVhJeKtPDdCOA:"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        if (!auth_response.ok) {
            throw new Error("Non-2xx response for reddit authentication.");
        }

        const auth_data = await auth_response.json();

        if (auth_data.access_token) {
            auth_data.expires_at = time() + auth_data.expires_in;
            window.sessionStorage.setItem("reddit_access_token", JSON.stringify(auth_data));
            return auth_data.access_token;
        } else {
            throw new Error("Missing access token.");
        }
    } else {
        return existingToken.access_token;
    }
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

    let apiEndpoint = `https://api.pushshift.io/reddit/search/${endpoint}/`;
    if (urlParams.get("meta_api") == "coddit") {
        apiEndpoint = `https://coddit.xyz/modtools/api/db/basicquery/${endpoint}`;
    }

    let fetchURL = apiEndpoint + (callParams.toString() ? "?" + callParams.toString() : "");

    updateRequestTable(fetchURL, "pending");

    try {
        console.log("fetching " + fetchURL + "...");
        const response = await fetch(fetchURL);

        updateRequestTable(fetchURL, response.status);

        if (!response.ok) {
            throw new Error("Non-2xx response status from " + fetchURL);
        }

        const data = await response.json();

        let items = data.data;

        if (items.children) {
            items = items.children.map((item) => item.data);
        }

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

        try {
            let refreshURL = "https://oauth.reddit.com/api/info?id=" + names.join(",");

            console.log("fetching " + refreshURL + "...");

            const refresh_response = await fetch(refreshURL, {
                headers: {
                    Authorization: "Bearer " + (await getAccessToken()),
                },
            });
            const refresh_data = await refresh_response.json();

            for (let refreshedItem of refresh_data.data.children) {
                refreshedItem = refreshedItem.data;
                for (let item of items) {
                    if (refreshedItem.name == item._name) {
                        item._refreshed_properties = {};
                        for (const [key, value] of Object.entries(refreshedItem)) {
                            if (!["author", "selftext", "body", "selftext_html", "body_html", "distinguished"].includes(key)) {
                                if (!(refreshedItem.author == "[deleted]" && refreshedItem[key] == null)) {
                                    item[key] = value;
                                }
                            } else if (["selftext_html", "body_html"].includes(key)) {
                                if (!item.hasOwnProperty(key.replace(/_html$/, ""))) {
                                    item[key] = value;
                                }
                            } else if (!item.hasOwnProperty(key)) {
                                item[key] = value;
                            } else {
                                item._refreshed_properties[key] = value;
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
        } catch (error) {
            console.error("Failed to refresh items from reddit API.");
            console.error(error);
            window.sessionStorage.removeItem("reddit_access_token");
        }

        for (let item of items) {
            item = appendExtraProps(item);
        }

        newItems = items.filter((item) => !cachedItems.has(item));

        for (let item of newItems) {
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

        gel("banner").innerHTML = "Error Loading Items: " + error.message || error;
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

    gel(
        "banner"
    ).innerHTML = `<img class="loading-icon" src="/search/static/CGH1e.png" style="height: 2em; vertical-align: middle; margin: 0 16px 2px 0;">Loading • Found <span class="loaded-count">0</span> Items`;
    gel("banner").hidden = false;

    while ((nextRequest = requestQueue.shift())) {
        let request = nextRequest;

        qel("#banner .loaded-count").innerHTML = cachedItems.valid.length;

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
        item.classList.remove("acting-first");
    });
    gel("load-more-button").classList.remove("acting-first");

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
                let addedFirst = false;
                let allowed = Array.from(tbody.children)
                    .filter((e) => !e.classList.contains(className))
                    .map((e) => e.querySelector("td:first-of-type a").innerHTML);
                for (let thing of gel("items").children) {
                    if (allowed.includes(thing.dataset[property])) {
                        thing.classList.remove(className);
                    } else {
                        thing.classList.add(className);
                    }
                    if (
                        !addedFirst &&
                        !thing.classList.contains("user-hidden-subreddit") &&
                        !thing.classList.contains("user-hidden-author")
                    ) {
                        if (!gel("items").children[0].isSameNode(thing)) {
                            thing.classList.add("acting-first");
                        }
                        addedFirst = true;
                    } else {
                        thing.classList.remove("acting-first");
                    }
                }
                if (!addedFirst) {
                    gel("load-more-button").classList.add("acting-first");
                } else {
                    gel("load-more-button").classList.remove("acting-first");
                }
                // gel("info-panel").scrollIntoView({ block: "start" });
            },
        });
    }

    function getExpandButtons(tbody) {
        let expandRow = cel("tr", [
            cel("td", '<a href="javascript:void(0);">...</a>'),
            cel("td", '<a href="javascript:void(0);">...</a>', "center"),
            cel("td", '<a href="javascript:void(0);">...</a>', "center"),
            cel("td", '<a href="javascript:void(0);">...</a>', "center"),
        ]);

        expandRow.onclick = () => {
            for (let row of tbody.children) {
                row.hidden = false;
            }
            expandRow.remove();
        };
        return expandRow;
    }

    info.appendChild(
        cel("table", [
            cel("caption", "Subreddits • " + subreddits.length),
            cel("thead", [cel("tr", [cel("th", "Subreddit"), cel("th", "Total"), cel("th", "Subs"), cel("th", "Coms")])]),
            (function () {
                let tbody = cel("tbody");
                for (let subreddit of subreddits) {
                    let row = cel("tr", [
                        cel("td", getListToggleButton(tbody, subreddit.name, "user-hidden-subreddit", "subreddit")),
                        cel("td", subreddit.contributions, "center"),
                        cel("td", subreddit.submissions, "center"),
                        cel("td", subreddit.comments, "center"),
                    ]);
                    tbody.appendChild(row);
                    if (tbody.childElementCount > 25) {
                        row.hidden = true;
                    }
                }

                if (tbody.childElementCount > 25) {
                    tbody.appendChild(getExpandButtons(tbody));
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
                    let row = cel("tr", [
                        cel("td", getListToggleButton(tbody, author.name, "user-hidden-subreddit", "subreddit")),
                        cel("td", author.contributions, "center"),
                        cel("td", author.submissions, "center"),
                        cel("td", author.comments, "center"),
                    ]);
                    tbody.appendChild(row);
                    if (tbody.childElementCount > 25) {
                        row.hidden = true;
                    }
                }

                if (tbody.childElementCount > 25) {
                    tbody.appendChild(getExpandButtons(tbody));
                }

                return tbody;
            })(),
        ])
    );

    gel("info-panel").classList.remove("collapsed");
}

if (getCookie("search_preferences")) {
    for (const [key, value] of Object.entries(JSON.parse(getCookie("search_preferences")))) {
        settings[key] = value;
    }
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

gel("parameter-meta_api").onchange = (event) => {
    if (event.target.value == "coddit") {
        alert(
            "NOTICE: The coddit statistics API is not a Pushshift equivalent.\n\nIts primary purpose is to provide subreddit analytics and moderation utilities for r/teenagers. It only contains data from a few select subreddits and does not support full text search or many of the other parameters available with Pushshift."
        );
    }
};

gel("request-form").onsubmit = (event) => {
    Array.from(event.target.querySelectorAll("input, select")).forEach((element) => {
        if (!element.value || element.value == element.dataset.defaultValue || element.disabled) {
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

qels("select").forEach((e) => {
    let p = e.parentElement;
    if (p.classList.contains("select")) {
        const ob = new MutationObserver(function (ms, ob) {
            ms.forEach((m) => {
                if (m.attributeName == "disabled") {
                    if (e.disabled) {
                        p.classList.add("disabled");
                    } else {
                        p.classList.remove("disabled");
                    }
                }
            });
        });
        ob.observe(e, { attributes: true });
    }
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
    let downloadItems = [];
    for (let cachedItem of cachedItems.shown) {
        let item = JSON.parse(JSON.stringify(cachedItem));
        for (const key in item) {
            if (key.startsWith("_")) {
                delete item[key];
            }
        }
        if (cachedItem._refreshed_properties) {
            item._refreshed_properties = cachedItem._refreshed_properties;
        }
        downloadItems.push(item);
    }
    let downloadString = JSON.stringify({ items: downloadItems }, null, 4);
    downloadText(downloadString, "data.json");
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

qels("[data-disable-on], [data-hide-on], [data-reset-on]").forEach((element) => {
    for (let category of ["disable", "hide", "reset"]) {
        if (!element.dataset[category + "On"]) {
            continue;
        }

        let conditions = [];

        for (let condition of element.dataset[category + "On"].split(";")) {
            let inverted = condition.match(/[^=]+!=/) ? true : false;
            let requirementDetails = condition.split(/!?=/);
            if (requirementDetails.length == 1) {
                if (requirementDetails[0].startsWith("!")) {
                    inverted = true;
                    requirementDetails[0] = requirementDetails[0].substring(1);
                }
            }
            let requirementInput = gel(requirementDetails[0]);
            let requirementValue = requirementDetails.slice(1).join("");

            let newCondition = { requirementInput, requirementValue, inverted };

            conditions.push(newCondition);

            validateRequirements();

            requirementInput.addEventListener(
                requirementInput.tagName == "SELECT" || requirementInput.type == "checkbox" ? "change" : "keyup",
                () => {
                    validateRequirements();
                }
            );
        }

        function onTrue() {
            switch (category) {
                case "disable":
                    element.disabled = true;
                    break;
                case "hide":
                    element.hidden = true;
                    break;
                case "reset":
                    element.value = element.defaultValue;
                    break;
            }
        }

        function onFalse() {
            switch (category) {
                case "disable":
                    element.disabled = false;
                    break;
                case "hide":
                    element.hidden = false;
                    break;
                case "reset":
                    break;
            }
        }

        function validateRequirements() {
            onFalse();
            for (let condition of conditions) {
                if (condition.requirementValue) {
                    if (!condition.inverted) {
                        if (!condition.requirementInput.value.match(condition.requirementValue)) {
                            onTrue();
                            return;
                        }
                    } else {
                        if (condition.requirementInput.value.match(condition.requirementValue)) {
                            onTrue();
                            return;
                        }
                    }
                } else {
                    if (!condition.inverted) {
                        if (!condition.requirementInput.value) {
                            onTrue();
                            return;
                        }
                    } else {
                        if (condition.requirementInput.value) {
                            onTrue();
                            return;
                        }
                    }
                }
            }
        }
    }
});
