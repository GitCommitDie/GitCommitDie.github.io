/**
 * This is what happens when you combine sleep deprivation, copious amounts of energy drinks, and not knowing how to code.
 *
 */

fetch(`https://coddit.xyz/api/analytics/ping?u=${encodeURIComponent(window.location.href)}`)
    .then((res) => {
        if (!res.ok) {
            throw new Error("Coddit API responded not okay.");
        }
        return res.json();
    })
    .then((data) => {
        if (data.status != "OK") {
            throw new Error("Coddit API responded not okay.");
        }
    })
    .catch((error) => {
        console.warn(error);
    });

const urlParams = new URLSearchParams(window.location.search);

var settings = {
    advanced: true,
    dev: false,
    hideNSFW: true,
    defaultPageSize: 25,
    refreshItems: true,
};

var cachedItems = {
    all: [],
    valid: [],
    aggregations: {
        all: [],
    },
    add(item) {
        if (this.all.every((x) => x.name != item.name)) {
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
        let returnedItems = [];
        for (let item of items) {
            item = this.add(item);
            if (item) returnedItems.add(item);
        }
        return returnedItems;
    },
    has(item) {
        return cachedItems.all.some((x) => x.name == item.name);
    },
    get shown() {
        return this.valid.filter((item) => item._meta.shown);
    },
    get hidden() {
        return this.valid.filter((item) => !item._meta.shown);
    },
};

var requests = {
    sources: [],
    history: [],
    get hasNext() {
        return requests.sources.some((i) => i.next);
    },
    addSource(request) {
        this.sources.push(request);
    },
};

var search = {
    get visibleLimit() {
        return this.size != "none"
            ? (this.size || settings.defaultPageSize) * gel("load-more-button").dataset.pageCount
            : Infinity;
    },
    get expectedLimit() {
        return this.visibleLimit * requests.sources.filter((i) => i.next).length;
    },
    get expectedMaximum() {
        return this.visibleLimit * requests.sources.length;
    },
};

var reddit = {
    client_id: "RiVhJeKtPDdCOA",
    async getAccessToken() {
        let existingToken = window.sessionStorage.getItem("reddit_access_token")
            ? JSON.parse(window.sessionStorage.getItem("reddit_access_token"))
            : null;
        if (!existingToken || existingToken.expires_at <= time()) {
            console.info("fetching access token...");
            const auth_response = await fetch("https://www.reddit.com/api/v1/access_token", {
                method: "POST",
                body: "grant_type=https://oauth.reddit.com/grants/installed_client&device_id=DO_NOT_TRACK_THIS_DEVICE",
                headers: {
                    Authorization: "Basic " + btoa(this.client_id + ":"),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            if (!auth_response.ok) {
                throw new Error("Non-2xx response for reddit authentication.");
            }

            const auth_data = await auth_response.json();

            if (auth_data.access_token) {
                let now = time();
                auth_data.retrieved_at = now;
                auth_data.expires_at = now + auth_data.expires_in;
                window.sessionStorage.setItem("reddit_access_token", JSON.stringify(auth_data));
                return auth_data.access_token;
            } else {
                throw new Error("Missing access token.");
            }
        } else {
            return existingToken.access_token;
        }
    },
    async get(path) {
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        let url = "https://oauth.reddit.com" + path;
        const response = await fetch(url, {
            headers: {
                Authorization: "Bearer " + (await this.getAccessToken()),
            },
        });

        if (!response.ok) {
            throw new Error("Non-2xx response from: " + url);
        }

        return await response.json();
    },
};

function appendItemProps(item, metadata) {
    if (!metadata) {
        metadata = {};
    }

    if (metadata.type) {
        if (!item.kind) {
            if (metadata.type == "comment") {
                item.kind = "t1";
            } else if (metadata.type == "submission") {
                item.kind = "t3";
            }
        }
        if (!item.type) {
            item.type = metadata.type;
        }
    }

    if (!item.name && item.fullname) {
        item.name = item.fullname;
    } else if (!item.fullname && item.name) {
        item.fullname = item.name;
    }

    if (!item.kind || !item.id) {
        if (item.fullname) {
            if (!item.kind) {
                item.kind = item.fullname.split("_")[0];
            }
            if (!item.id) {
                item.id = item.fullname.split("_")[1];
            }
        } else if (item.name) {
            if (!item.kind) {
                item.kind = item.name.split("_")[0];
            }
            if (!item.id) {
                item.id = item.name.split("_")[1];
            }
        }
    }

    if ((!item.fullname || !item.name) && item.kind && item.id) {
        if (!item.fullname) {
            item.fullname = item.kind + "_" + item.id;
        }
        if (!item.name) {
            item.name = item.kind + "_" + item.id;
        }
    }

    if (!item.permalink && item.kind && item.subreddit && item.id) {
        if (item.kind == "t1") {
            if (item.link_id) {
                item.permalink = `/r/${item.subreddit}/comments/${item.link_id}/-/${item.id}/`;
            }
        } else if (item.kind == "t3") {
            item.permalink = `/r/${item.subreddit}/comments/${item.id}/-/`;
        }
    }

    if (!item.full_link && item.permalink) {
        item.full_link = "https://www.reddit.com" + item.permalink;
    }

    item._meta = metadata;

    return item;
}

function appendExtraProps(item) {
    item._meta.state = "live";
    if (item.removed_by_category) {
        if (item.removed_by_category == "deleted") {
            item._meta.state = "deleted";
        } else {
            item._meta.state = "removed " + item.removed_by_category;
        }
    } else {
        if (item.kind == "t1") {
            if (
                (item.author == "[deleted]" && item.body == "[removed]") ||
                (item._refreshed_properties &&
                    item._refreshed_properties.author == "[deleted]" &&
                    item._refreshed_properties.body == "[removed]")
            ) {
                item._meta.state = "removed maybe";
            } else if (
                (item.author == "[deleted]" && item.body == "[deleted]") ||
                (item._refreshed_properties &&
                    item._refreshed_properties.author == "[deleted]" &&
                    item._refreshed_properties.body == "[deleted]")
            ) {
                item._meta.state = "deleted maybe";
            }
        } else if (item.kind == "t3") {
            if (
                item.selftext == "[removed]" ||
                (item._refreshed_properties && item._refreshed_properties.selftext == "[removed]")
            ) {
                item._meta.state = "removed maybe";
            } else if (
                (item.author == "[deleted]" && item.selftext == "[deleted]") ||
                (item._refreshed_properties &&
                    item._refreshed_properties.author == "[deleted]" &&
                    item._refreshed_properties.selftext == "[deleted]")
            ) {
                item._meta.state = "deleted maybe";
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
            item.kind == "t1"
                ? item.parent_id.startsWith("t1_")
                    ? celp("li", "RC", { classList: "full-type", title: "Comment Reply" })
                    : celp("li", "TC", { classList: "full-type", title: "Top-Level Comment" })
                : item.is_video
                ? celp("li", "VS", { classList: "full-type", title: "Video Submission" })
                : item.is_gallery
                ? celp("li", "GS", { classList: "full-type", title: "Gallery Submission" })
                : item.poll_data
                ? celp("li", "PS", { classList: "full-type", title: "Poll Submission" })
                : item.url.match(/^https?:\/\/[iv]\.redd\.it\//)
                ? celp("li", "MS", { classList: "full-type", title: "Media Submission" })
                : item.is_self
                ? celp("li", "TS", { classList: "full-type", title: "Self-Post Submission" })
                : celp("li", "LS", { classList: "full-type", title: "Link Submission" }),
            item.score != null
                ? celp("li", abbreviateNumber(item.score), {
                      classList: "score",
                      title: commaSeparateNumber(item.score) + " Upvote" + (item.score != 1 ? "s" : ""),
                  })
                : null,
            item.upvote_ratio
                ? celp("li", parseInt(item.upvote_ratio * 100) + "%", {
                      classList: "upvote-ratio advanced-option",
                      title: parseInt(item.upvote_ratio * 100) + "% Upvoted",
                  })
                : null,
            item.all_awardings && item.all_awardings.length // item.all_awardings?.length isn't workingggg
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
            item.is_original_content ? celp("li", "OC", { classList: "tag oc", title: "Tagged as Original Content" }) : null,
            item.distinguished
                ? celp("li", "Distinguished", {
                      classList: "tag distinguished " + item.distinguished,
                      title: "Distinguished as " + item.distinguished.charAt(0).toUpperCase() + item.distinguished.slice(1),
                  })
                : null,
            item.stickied ? celp("li", "Stickied", { classList: "tag stickied", title: "Pinned by Moderator" }) : null,
            item.locked ? celp("li", "Locked", { classList: "tag locked", title: "Locked by Moderator" }) : null,
            item.archived ? celp("li", "Archived", { classList: "tag archived", title: "Archived" }) : null,
            item._meta.state.includes("deleted")
                ? celp("li", "Deleted", { classList: "tag deleted", title: "Deleted by Author" })
                : item._meta.state == "removed moderator"
                ? celp("li", "Removed by Moderator", {
                      classList: "tag removed moderator",
                      title: "Removed by Subreddit Moderator",
                  })
                : item._meta.state == "removed reddit"
                ? celp("li", "Removed by Reddit", { classList: "tag removed reddit", title: "Removed by Reddit" })
                : item._meta.state.includes("removed")
                ? celp("li", "Removed", { classList: "tag removed", title: "Removed" })
                : item._meta.state == "missing"
                ? celp("li", "Missing", { classList: "tag warn", title: "Item could not be found on Reddit." })
                : null,
            item._meta.refreshed
                ? celp("li", "", { classList: "tag refreshed", title: "Synced with Reddit" })
                : settings.refreshItems
                ? celp("li", "", { classList: "tag refresh-failed", title: "Failed to Sync with Reddit" })
                : null,
        ],
        "info"
    );
}

function getContent(item) {
    if (item.kind == "t1") {
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
    } else if (item.kind == "t3") {
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
                        return `<video controls><source src="${item.media.reddit_video.fallback_url}"></video>`;
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
    let attributes = [
        item.fullname ? ["data-fullname", item.fullname] : null,
        item.name ? ["data-name", item.name] : null,
        item.id ? ["data-id", item.id] : null,
        item.kind ? ["data-kind", item.kind] : null,
        item.type ? ["data-type", item.type] : null,
        item.created_utc ? ["data-created-utc", item.created_utc] : null,
        item.permalink ? ["data-permalink", item.permalink] : null,
        item.author ? ["data-author", item.author] : null,
        item.subreddit ? ["data-subreddit", item.subreddit] : null,
        item.name ? ["id", "thing-" + item.name] : null,
    ];

    let displayItem = celwa("div", attributes, item.name, "item thing");

    function parseRichtext(richtext) {
        let parsed = "";
        for (let element of richtext) {
            if (element.e == "text") {
                parsed += `<span>${element.t}</span>`;
            } else if (element.e == "emoji") {
                parsed += `<img src="${element.u}" alt="${element.a}" class="emoji" title="${element.a}">`;
            }
        }
        return parsed;
    }

    function parseFlair(flair_type, flair_richtext, flair_text, flair_background_color, flair_text_color) {
        let flairContent = "";
        if (flair_type == "richtext" && flair_richtext && flair_richtext.length) {
            flairContent +=
                '<span class="flair richtext' +
                (flair_text_color ? " " + flair_text_color : "") +
                (flair_background_color && flair_background_color != "transparent" ? " has-background" : "") +
                '"';
            let style = "";
            if (flair_background_color) {
                style += `background-color: ${flair_background_color};`;
            }
            if (style) {
                flairContent += ` style="${style}"`;
            }
            flairContent += ` title="${flair_text}">` + parseRichtext(flair_richtext) + "</span>";
        } else if (flair_text) {
            flairContent = `<span class="flair plaintext" title="${flair_text}">${flair_text}</span>`;
        }
        return flairContent;
    }

    function getTagline() {
        return cel(
            "p",
            `${item.kind == "t3" ? "submitted" : "commented"} by <a href="https://www.reddit.com/user/${
                item.author
            }" class="author">u/${item.author}</a>` +
                parseFlair(
                    item.author_flair_type,
                    item.author_flair_richtext,
                    item.author_flair_text,
                    item.author_flair_background_color,
                    item.author_flair_text_color
                ) +
                ` <time datetime="${new Date(item.created_utc * 1000).toString()}" title="${new Date(
                    item.created_utc * 1000
                ).toString()}" class="created-utc">${formatTime(
                    time() - item.created_utc
                )} ago</time> in <a href="https://www.reddit.com/r/${item.subreddit}" class="subreddit">r/${
                    item.subreddit
                }</a>`,
            "tagline"
        );
    }

    function getTitleContent() {
        return cel(
            "h1",
            `<a href="${item.full_link}" class="title-link">${(function () {
                let string = item.title;
                if (urlParams.has("q")) {
                    for (let part of urlParams.get("q").split(/[^a-z0-9_.]/gi)) {
                        string = mdHighlight(string, "\\b" + part + "\\b");
                    }
                }
                return string;
            })()}</a>` +
                parseFlair(
                    item.link_flair_type,
                    item.link_flair_richtext,
                    item.link_flair_text,
                    item.link_flair_background_color,
                    item.link_flair_text_color
                ) +
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
                cel("li", `<a href="${item.full_link}" target="_blank">view on reddit</a>`),
                cel("li", `<a href="https://www.removeddit.com${item.permalink}" target="_blank">view on removeddit</a>`),
                cel(
                    "li",
                    `<a href="https://api.pushshift.io/reddit/search/${item.type}/?ids=${item.id}" target="_blank">view on pushshift</a>`,
                    "advanced-option dev-option"
                ),
                search.api == "coddit" && item._meta.state.includes("deleted")
                    ? cel(
                          "li",
                          `<a href="https://coddit.xyz/modtools/undelete/?id=${item.name}" target="_blank">recover via coddit undelete</a>`,
                          "advanced-option"
                      )
                    : null,
                cel(
                    "li",
                    `<a href="${item._meta.fetched_from}">${item.fullname} ??? Request: ${item._meta.request_id} ??? Item: ${
                        item._meta.sibling_position
                    }/${item._meta.sibling_count}${item._meta.refreshed ? " ??? Refreshed" : ""}</a>`,
                    "request-info advanced-option dev-option"
                ),
            ],
            "buttons"
        );
    }

    switch (item.kind) {
        case "t1":
            displayItem = celwa(
                "div",
                attributes,
                [
                    getTagline(),
                    getInfoTags(item),
                    getContent(item),
                    settings.dev
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
                    "comment",
                    item._meta.state ? item._meta.state.split(" ")[0] : null,
                    item._meta.refreshed ? "refreshed" : null,
                    item._meta.missing ? "missing" : null,
                ]
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
                    settings.dev
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
                    item.is_self ? "self" : "link",
                    item.over_18 ? "nsfw" : null,
                    item._meta.state ? item._meta.state.split(" ")[0] : null,
                    item._meta.refreshed ? "refreshed" : null,
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
            if (item.kind == "t1") {
                valid = item.body.match(params.get("q"));
            } else if (item.kind == "t3") {
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
            if (item.kind == "t1") {
                valid = item.body.match(urlParams.get("meta_filter_pattern"));
            } else if (item.kind == "t3") {
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
            valid = urlParams.get("meta_state").split(/[,+ ]/).includes(item._meta.state.split(" ")[0]);
        }
        return valid;
    }
    return [checkExact, filterPattern, filterPatternSubreddit, filterPatternAuthor, checkSearchFields, checkState].every(
        (check) => check()
    );
}

async function fetchItems(request) {
    try {
        let params = new URLSearchParams(request.params.toString());

        let fetchParams = new URLSearchParams(params.toString());

        let apiEndpoint = `https://api.pushshift.io/reddit/${request.type}/search`;
        let separator = "?";
        let fetchOptions = {};

        if (search.api == "pushshift") {
            if (fetchParams.has("after") && !fetchParams.has("sort")) {
                fetchParams.set("sort", "desc");
            }
        } else if (search.api == "coddit") {
            apiEndpoint = `https://coddit.xyz/modtools/api/db/basicquery/${request.type}`;
        } else if (search.api == "miser") {
            apiEndpoint = `https://archivesort.org/discuss/reddit/miser?type=${request.type}s`;
            separator = "&";
        } else if (search.api == "reddit") {
            if (fetchParams.has("subreddit")) {
                apiEndpoint = `https://oauth.reddit.com/r/${fetchParams.get("subreddit")}/search`;
                fetchParams.set("restrict_sr", "true");
                fetchParams.delete("subreddit");
            } else {
                apiEndpoint = "https://oauth.reddit.com/search";
            }
            fetchOptions.headers = { Authorization: "Bearer " + (await reddit.getAccessToken()) };
        }

        if (["pushshift", "coddit"].includes(search.api)) {
            fetchParams.set("size", 100);
            ["filter", "limit"].forEach((i) => fetchParams.delete(i));
        } else if (["miser"].includes(search.api)) {
            fetchParams.set("size", search.size != "none" ? Math.min(search.size, 1000) : 1000);
        } else if (["reddit"].includes(search.api)) {
            fetchParams.set("limit", search.size != "none" ? Math.min(search.size, 100) : 100);
        }

        let fetchURL = apiEndpoint + (fetchParams.toString() ? separator + fetchParams.toString() : "");

        updateRequestTable(fetchURL, "pending");

        if (requests.history.length && Date.now() - requests.history[requests.history.length - 1].time < 1000) {
            let cooldownDuration = 1000 - (Date.now() - requests.history[requests.history.length - 1].time);
            console.info("waiting " + cooldownDuration + "ms...");
            await sleep(cooldownDuration);
        }

        try {
            console.info("fetching " + fetchURL + "...");
            const response = await fetch(fetchURL, fetchOptions);

            updateRequestTable(fetchURL, response.status);

            if (!response.ok) {
                throw new Error("Non-2xx response status from: " + fetchURL);
            }

            const data = await response.json();

            let items = data.data;

            if (items.children) {
                items = items.children.map((item) => item.data);
            }

            let names = [];
            let uniqueTimestamps = [];

            items.forEach((item) => {
                item = appendItemProps(item, {
                    type: request.type,
                    fetched_from: fetchURL,
                    request_id: requests.history.length,
                    sibling_count: items.length,
                    sibling_position: items.indexOf(item) + 1,
                    valid: false,
                    refreshed: search.api == "reddit",
                });
                names.push(item.name);
                if (!uniqueTimestamps.includes(item.created_utc)) {
                    uniqueTimestamps.push(item.created_utc);
                }
            });

            if (uniqueTimestamps.length == 1 && items.length >= 100) {
                console.warn("Encountered second-segment with >=100 items. Accuracy may be affected.");
            }

            if (items.length && settings.refreshItems && search.api != "reddit") {
                try {
                    let refreshPath = "/api/info?id=" + names.join(",");

                    console.info("fetching https://oauth.reddit.com" + refreshPath + "...");

                    const refresh_data = await reddit.get(refreshPath);

                    for (let refreshedItem of refresh_data.data.children) {
                        refreshedItem = refreshedItem.data;
                        for (let item of items) {
                            if (refreshedItem.name == item.name) {
                                item._refreshed_properties = {};
                                for (const [key, value] of Object.entries(refreshedItem)) {
                                    if (
                                        ![
                                            "author",
                                            "selftext",
                                            "body",
                                            "selftext_html",
                                            "body_html",
                                            "title",
                                            "distinguished",
                                        ].includes(key)
                                    ) {
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
                                array_remove(names, item.name);
                                break;
                            }
                        }
                    }

                    for (let name of names) {
                        for (let item of items) {
                            if (name == item.name) {
                                item._meta.missing = true;
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to refresh items from reddit API.");
                    console.error(error);
                }
            }

            for (let item of items) {
                item = appendExtraProps(item);
            }

            let newItems = items.filter((item) => !cachedItems.has(item));

            for (let item of newItems) {
                item._meta.valid = validateItem(item, params);
                cachedItems.add(item);
            }

            if (data.aggs) {
                cachedItems.aggregations.all.push(data.aggs);
            }

            if (items.length >= (fetchParams.get("size") || fetchParams.get("limit")) && newItems.length) {
                if (["pushshift", "coddit", "miser"].includes(search.api)) {
                    if (search.sort == "asc") {
                        params.set("after", items[items.length - 1].created_utc - (uniqueTimestamps.length != 1 ? 1 : 0)); // i don't like it either
                    } else {
                        params.set("before", items[items.length - 1].created_utc + (uniqueTimestamps.length != 1 ? 1 : 0));
                    }
                    return { next: { type: request.type, params }, fetchedURL: fetchURL };
                } else if (search.api == "reddit") {
                    if (data.data.after) {
                        params.set("after", data.data.after);
                        return { next: { type: request.type, params }, fetchedURL: fetchURL };
                    }
                }
            }
        } catch (error) {
            updateRequestTable(fetchURL, "failed");
            throw error;
        }

        return { next: null, fetchedURL: fetchURL };
    } catch (error) {
        console.error(error);

        gel("banner").innerHTML = "Error Loading Items: " + error.message || error;
        gel("banner").classList.add("failed");

        throw error;
    }
}

async function processQueue() {
    document.title = "Search Results - Coddit Search";
    gel("parameters-panel").classList.add("collapsed");
    gel("items-panel").classList.remove("collapsed");
    gel("load-more-button").hidden = true;

    gel("banner").innerHTML =
        `<img class="loading-icon" src="/search/static/CGH1e.png">Loading ??? Found ` +
        `<span class="loaded-count">${cachedItems.valid.length}</span>/` +
        `~<span class="expected-count">${search.size != "none" ? search.expectedMaximum : "???"}</span> Items in ` +
        `<span class="request-count">${requests.history.length}</span> Requests`;
    gel("banner").hidden = false;

    while ((search.size == "none" || cachedItems.valid.length < search.expectedLimit) && requests.hasNext) {
        for (let i = 0; i < requests.sources.length; i++) {
            let source = requests.sources[i];
            if (!source.next) continue;

            let fetchResult = await fetchItems(source.next);
            source.next = fetchResult.next;
            requests.history.push({ url: fetchResult.fetchedURL, time: Date.now() });

            sortItems();

            qel("#banner .loaded-count").innerHTML = cachedItems.valid.length;
            qel("#banner .expected-count").innerHTML = search.size != "none" ? search.expectedMaximum : "???";
            qel("#banner .request-count").innerHTML = requests.history.length;
        }
    }

    if (cachedItems.valid.length) {
        gel("banner").hidden = true;
        if (!search.narrow && cachedItems.valid.length >= search.visibleLimit) {
            gel("load-more-button").hidden = false;
        }
    } else {
        if (!gel("banner").classList.contains("failed")) gel("banner").innerHTML = "No Data";
    }
    showItems();
    if (settings.advanced) {
        try {
            updateInfo();
            gel("info-panel").classList.remove("collapsed");
        } catch (error) {
            console.error("Failed to update results information.");
            console.error(error);
        }
    }
    if (cachedItems.aggregations.all.length && settings.advanced) {
        try {
            updateAggregationInfo();
            gel("aggregations-panel").hidden = false;
            gel("aggregations-panel").classList.remove("collapsed");
        } catch (error) {
            console.error("Failed to update aggregation information.");
            console.error(error);
        }
    }
}

function sortItems() {
    cachedItems.valid.sort((a, b) => {
        if (search.sort == "asc") {
            return a.created_utc > b.created_utc ? 1 : b.created_utc > a.created_utc ? -1 : 0;
        } else {
            return a.created_utc < b.created_utc ? 1 : b.created_utc < a.created_utc ? -1 : 0;
        }
    });
}

function showItems() {
    let itemsContainer = gel("items");
    for (let i = 0; i < cachedItems.valid.length; i++) {
        let item = cachedItems.valid[i];
        if (i > search.visibleLimit - 1) {
            break;
        }
        if (item._meta.shown) {
            continue;
        }
        item._meta.shown = true;
        try {
            itemsContainer.appendChild(getDisplayItem(item));
        } catch (error) {
            console.error(`failed to show item ${item.name}`);
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

        if (item.type == "submission") {
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
            cel("caption", "Subreddits ??? " + subreddits.length),
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
            cel("caption", "Authors ??? " + authors.length),
            cel("thead", [cel("tr", [cel("th", "Author"), cel("th", "Total"), cel("th", "Subs"), cel("th", "Coms")])]),
            (function () {
                let tbody = cel("tbody");
                for (let author of authors) {
                    let row = cel("tr", [
                        cel("td", getListToggleButton(tbody, author.name, "user-hidden-author", "author")),
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
}

function updateAggregationInfo() {
    let aggInfo = gel("aggregations");
    let aggs = cachedItems.aggregations.all[0];

    for (let agg in aggs) {
        let aggregation = aggs[agg];
        let aggTitle = agg.replace(/[_-]+/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
        let keyTitle = "Key";
        let valueTitle = "Count";
        let keyKey = "key"; // xd
        let valueKey = "doc_count";

        if (agg == "author") {
            keyTitle = "Username";
        } else if (agg == "subreddit") {
            keyTitle = "Subreddit";
        }

        let tbody = cel("tbody");

        let table = cel("table", [cel("thead", [cel("tr", [cel("th", keyTitle), cel("th", valueTitle)])]), tbody]);

        for (let i = 0; i < aggregation.length; i++) {
            let aggregate = aggregation[i];
            let row = cel("tr", [
                cel("td", aggregate[keyKey] != null ? aggregate[keyKey] : celp("em", "NULL", { style: "opacity: 0.5;" })),
                cel("td", aggregate[valueKey], "center"),
            ]);
            tbody.appendChild(row);
            if (i > 25) row.hidden = true;
        }

        if (aggregation.length > 25) {
            let expandRow = celp("tr", [cel("td", cel("em", "Click to Show More")), cel("td", cel("em", "..."), "center")], {
                style: "cursor: pointer;",
            });
            expandRow.onclick = () => {
                expandRow.remove();
                Array.from(tbody.children).forEach((i) => (i.hidden = false));
            };
            tbody.appendChild(expandRow);
        }

        let chartCanvas = cel("canvas", null);
        aggInfo.appendChild(
            celp(
                "div",
                [
                    cel("h3", aggTitle, "agg-title"),
                    cel("div", [cel("div", table, "table-container"), cel("div", chartCanvas, "chart-container")], "content"),
                ],
                {
                    classList: "aggregation",
                }
            )
        );
        let ctx = chartCanvas.getContext("2d");
        new Chart(ctx, {
            type: "pie",
            data: {
                labels: aggregation.map((i) => i[keyKey]).slice(0, 10),
                datasets: [
                    {
                        label: aggTitle + "s",
                        data: aggregation.map((i) => i[valueKey]).slice(0, 10),
                        borderWidth: 1,
                        backgroundColor: [
                            "#F44336",
                            "#E91E63",
                            "#9C27B0",
                            "#673AB7",
                            "#3F51B5",
                            "#2196F3",
                            "#03A9F4",
                            "#00BCD4",
                            "#009688",
                            "#4CAF50",
                            "#8BC34A",
                            "#CDDC39",
                            "#FFEB3B",
                            "#FFC107",
                            "#FF9800",
                            "#FF5722",
                            "#795548",
                            "#9E9E9E",
                            "#607D8B",
                        ],
                    },
                ],
            },
            options: {
                responsive: true,
            },
        });
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

function loadSettings() {
    if (getCookie("search_preferences")) {
        for (const [key, value] of Object.entries(JSON.parse(getCookie("search_preferences")))) {
            settings[key] = value;
        }
    }

    if (settings.advanced) {
        document.body.classList.add("setting-advanced");
    } else {
        qels(".advanced-option input, .advanced-option select").forEach((element) => {
            element.disabled = true;
        });
    }

    if (settings.dev) {
        document.body.classList.add("setting-dev");
    } else {
        qels(".dev-option input, .dev-option select").forEach((element) => {
            element.disabled = true;
        });
    }
}

function getPageTitle() {
    let title = "";
    if (search.type == "submission") {
        title += "Submissions ";
    } else if (search.type == "comment") {
        title += "Comments ";
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

    return title + " - Coddit Search Results";
}

qels("input[type='checkbox']").forEach((element) => {
    element.value = element.checked;
    element.addEventListener("change", () => {
        element.value = element.checked;
    });
});

qels("select").forEach((element) => {
    element.defaultValue = element.value;
    let p = element.parentElement;
    if (p.classList.contains("select")) {
        const ob = new MutationObserver(function (ms, ob) {
            ms.forEach((m) => {
                if (m.attributeName == "disabled") {
                    if (element.disabled) {
                        p.classList.add("disabled");
                    } else {
                        p.classList.remove("disabled");
                    }
                }
            });
        });
        ob.observe(element, { attributes: true });
    }
});

function updateOptions(event) {
    let api = urlParams.get("meta_api") || gel("p-meta_api").defaultValue;
    if (event) {
        api = gel("p-meta_api").value;
        if (api == "coddit") {
            alert(
                "NOTICE: The coddit statistics API is not a Pushshift equivalent.\n\nIts primary purpose is to provide subreddit analytics and moderation utilities for r/teenagers. It only contains data from a few select subreddits and does not support full text search or many of the other parameters available with Pushshift."
            );
        }
    }
    if (api == "reddit") {
        gel("p-q").required = true;
        gel("p-size").name = "limit";
    } else {
        gel("p-q").required = false;
        gel("p-size").name = "size";
    }
    for (let duplicateKey of ["sort"]) {
        qels(`[name="${duplicateKey}"]`).forEach((e) => {
            e.value = e.defaultValue;
        });
    }
}

updateOptions();

gel("p-meta_api").onchange = updateOptions;
gel("form-reset").onclick = (event) => {
    setTimeout(() => {
        updateOptions(event);
    }, 0);
};

loadSettings();

if (window.location.href.split("?").length > 1) {
    search.type = urlParams.get("meta_type") || gel("p-meta_type").defaultValue;
    search.api = urlParams.get("meta_api") || gel("p-meta_api").defaultValue;
    search.size = urlParams.get("size") || urlParams.get("limit") || settings.defaultPageSize;
    search.sort = urlParams.get("sort") || gel("ps-standard-sort").defaultValue;
    search.narrow = urlParams.has("ids") || urlParams.has("fullname");
    search.params = new URLSearchParams(window.location.search);

    if (search.size != "none") {
        search.size = parseInt(search.size);
    }

    gel("items-panel").hidden = false;
    gel("info-panel").hidden = false;
    gel("requests-panel").hidden = false;

    qels("#request-form input, #request-form select").forEach((element) => {
        let eqvParam = element.name.replace(/\[\]$/, "");
        if (search.params.has(eqvParam)) {
            if (element.name.match(/\[\]$/)) {
                element.value = "";
                for (const [key, value] of search.params.entries()) {
                    if (key == element.name.replace(/\[\]$/, "")) {
                        element.value += value + ";";
                    }
                }
                element.value = element.value.substring(0, element.value.length - 1);
            } else {
                if (element.type == "checkbox") {
                    element.checked = search.params.get(eqvParam) == "true";
                } else {
                    element.value = search.params.get(eqvParam);
                }
            }
        }
    });

    ["before", "after"].forEach((parameter) => {
        if (search.params.has(parameter) && search.params.get(parameter).match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            search.params.set(parameter, Date.parse(search.params.get(parameter)) / 1000);
        }
    });

    let queryParams = new URLSearchParams(
        [...search.params.entries()]
            .filter((param) => param[1] && !param[0].startsWith("meta_"))
            .reduce((x, y) => {
                return x + y[0] + "=" + encodeURIComponent(y[1]) + "&";
            }, "?")
    );

    if (search.api == "reddit") {
        search.type = "submission";
    }

    if (search.type == "any") {
        requests.addSource({ next: { type: "submission", params: queryParams } });
        requests.addSource({ next: { type: "comment", params: queryParams } });
    } else {
        requests.addSource({ next: { type: search.type, params: queryParams } });
    }

    processQueue();

    gel("load-more-button").innerHTML = "Load " + (search.sort == "asc" ? "After" : "Before");
    gel("load-more-button").onclick = (event) => {
        event.target.dataset.pageCount = parseInt(event.target.dataset.pageCount) + 1;
        processQueue();
    };
}

gel("request-form").onsubmit = (event) => {
    if (gel("p-meta_api").value == "miser") {
        if (!gel("p-q").value && !gel("p-author").value && !gel("p-subreddit").value) {
            alert('The Miser API requires at least one of the following parameters to be set: "q", "author", "subreddit".');
            event.preventDefault();
            return;
        }
    }

    if (gel("p-aggs").value) {
        if (!gel("p-after").value) {
            alert("Aggregation requests require a valid after parameter.");
            event.preventDefault();
            return;
        }
    }

    Array.from(event.target.querySelectorAll("input, select")).forEach((element) => {
        if (!element.value || (element.type != "checkbox" && element.value == element.defaultValue) || element.disabled) {
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

if (gel("notice")) {
    if (!getCookie("read_notice")) gel("notice").hidden = false;
}

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

            if (requirementInput.tagName == "SELECT") {
                requirementInput.addEventListener("change", validateRequirements);
            } else {
                requirementInput.addEventListener("keyup", validateRequirements);
                requirementInput.addEventListener("change", validateRequirements);
            }
        }

        element.closest("form").addEventListener("reset", () => {
            setTimeout(() => {
                validateRequirements();
            }, 0); // yes this is required
        });

        function onTrue() {
            switch (category) {
                case "disable":
                    element.disabled = true;
                    element.classList.add("data-disabled");
                    break;
                case "hide":
                    element.hidden = true;
                    element.classList.add("data-hidden");
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
                    element.classList.remove("data-disabled");
                    break;
                case "hide":
                    element.hidden = false;
                    element.classList.remove("data-hidden");
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
                        if (condition.requirementInput.value.match(condition.requirementValue)) {
                            onTrue();
                            return;
                        }
                    } else {
                        if (!condition.requirementInput.value.match(condition.requirementValue)) {
                            onTrue();
                            return;
                        }
                    }
                } else {
                    if (!condition.inverted) {
                        if (condition.requirementInput.value) {
                            onTrue();
                            return;
                        }
                    } else {
                        if (!condition.requirementInput.value) {
                            onTrue();
                            return;
                        }
                    }
                }
            }
        }
    }
});
