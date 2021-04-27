function gel(id) {
    return document.getElementById(id);
}

function gels(className) {
    return Array.from(document.getElementsByClassName(className));
}

function qel(selector) {
    return document.querySelector(selector);
}

function qels(selector) {
    return Array.from(document.querySelectorAll(selector));
}

function celfprops(properties) {
    const icn = (anything) => {
        return anything !== null && anything !== undefined && anything !== "" && anything !== [] && anything !== {};
    };

    let element = document.createElement("div");

    if (properties.tagName) {
        if (icn(properties.tagName)) {
            element = document.createElement(properties.tagName);
        }
    }

    if (properties.fromString) {
        if (icn(properties.fromString)) {
            element = new DOMParser().parseFromString(string, "text/html").body.firstChild;
        }
    }

    if (properties.innerHTML != null) {
        if (Array.isArray(properties.innerHTML)) {
            // let innerHTML = "";
            // for (let innerElement of properties.innerHTML) {
            //     if (icn(innerElement)) {
            //         if (innerElement instanceof HTMLElement) {
            //             innerHTML += innerElement.outerHTML;
            //         } else {
            //             innerHTML += innerElement;
            //         }
            //     }
            // }
            // element.innerHTML = innerHTML;
            for (let innerElement of properties.innerHTML) {
                if (icn(innerElement)) {
                    if (innerElement instanceof HTMLElement) {
                        element.appendChild(innerElement);
                    } else {
                        let containerElement = document.createElement("span");
                        containerElement.innerHTML = innerElement;
                        element.appendChild(containerElement);
                    }
                }
            }
        } else {
            if (icn(properties.innerHTML)) {
                if (properties.innerHTML instanceof HTMLElement) {
                    element.appendChild(properties.innerHTML);
                } else {
                    element.innerHTML = properties.innerHTML;
                }
            }
        }
    }

    if (properties.classList) {
        if (Array.isArray(properties.classList)) {
            for (let className of properties.classList) {
                if (icn(className)) {
                    element.classList.add(className);
                }
            }
        } else {
            if (icn(properties.classList)) {
                element.classList = properties.classList;
            }
        }
    }

    if (properties.id) {
        if (icn(properties.id)) {
            element.id = properties.id;
        }
    }

    if (properties.attributes) {
        if (Array.isArray(properties.attributes)) {
            for (let attribute of properties.attributes) {
                if (Array.isArray(attribute)) {
                    if (attribute.length > 1 && icn(attribute[0]) && icn(attribute[1])) {
                        element.setAttribute(attribute[0], attribute[1]);
                    } else if (attribute.length && icn(attribute[0])) {
                        element.setAttribute(attribute[0], "");
                    }
                } else {
                    if (icn(attribute)) {
                        element.setAttribute(attribute, "");
                    }
                }
            }
        } else if (typeof properties.attributes == "object") {
            for (let [key, value] of Object.entries(properties.attributes)) {
                key = key.replace(/_/g, "-").replace(/[^a-z0-9-]/gi, "");
                if (icn(key) && icn(value)) {
                    element.setAttribute(key, value);
                } else if (icn(key)) {
                    element.setAttribute(key, "");
                }
            }
        } else if (typeof properties.attributes == "string") {
            for (let attribute of properties.attributes.split(/ +/)) {
                attribute = attribute.replace(/[^a-z0-9-]/gi, "");
                if (icn(attribute)) {
                    element.setAttribute(attribute, "");
                }
            }
        }
    }

    if (properties.eventListeners) {
        if (typeof properties.eventListeners == "object") {
            for (let [key, value] of Object.entries(properties.eventListeners)) {
                key = key.replace(/[^a-z0-9-]/gi, "");
                if (icn(key) && typeof value == "function") {
                    element.addEventListener(key, value);
                }
            }
        }
    }

    for (const [key, value] of Object.entries(properties)) {
        if (["tagName", "fromString", "innerHTML", "classList", "id", "attributes", "eventListeners"].indexOf(key) == -1) {
            if (typeof value == "function") {
                element[key] = value;
            } else {
                if (icn(key) && icn(value)) {
                    element.setAttribute(key, value);
                }
            }
        }
    }

    return element;
}

function celp(tagName, innerHTML, properties) {
    properties.tagName = tagName;
    properties.innerHTML = innerHTML;
    return celfprops(properties);
}

function cel(tagName, innerHTML, classList, id) {
    let element = document.createElement(tagName);
    if (innerHTML !== null && innerHTML !== undefined) {
        if (Array.isArray(innerHTML)) {
            for (let item of innerHTML) {
                if (!item) continue;
                if (item instanceof HTMLElement) {
                    element.appendChild(item);
                } else {
                    element.innerHTML = item;
                }
            }
        } else {
            if (innerHTML instanceof HTMLElement) {
                element.appendChild(innerHTML);
            } else {
                element.innerHTML = innerHTML;
            }
        }
    }
    if (classList) {
        if (Array.isArray(classList)) {
            for (let className of classList) {
                if (className) {
                    element.classList.add(className);
                }
            }
        } else {
            element.classList = classList;
        }
    }
    if (id) {
        element.id = id;
    }
    return element;
}

function celwa(tagName, attributes, innerHTML, classList, id) {
    let element = cel(tagName, innerHTML, classList, id);
    attributes.forEach((e) => {
        if (!e) return;
        if (e[1]) {
            element.setAttribute(e[0], e[1]);
        } else {
            element.setAttribute(e[0]);
        }
    });
    return element;
}

function celfs(string) {
    return new DOMParser().parseFromString(string, "text/html").body.firstChild;
}

function getParams() {
    return new URLSearchParams(window.location.search);
}

function getParam(key) {
    params = getParams();
    let value = null;
    if (params.has(key)) {
        value = params.get(key);
    }
    return value;
}

function setParam(key, value) {
    newParams = getParams();
    if (newParams.has(key)) {
        newParams.delete(key);
    }
    newParams.append(key, value);
    if (newParams.toString() != "") {
        history.pushState({ cleared: key }, `cleared ${key}`, window.location.href.split("?")[0] + "?" + newParams.toString());
    } else {
        history.pushState({ cleared: key }, `cleared ${key}`, window.location.href.split("?")[0]);
    }
}

function clearParam(key) {
    newParams = getParams();
    if (newParams.has(key)) {
        newParams.delete(key);
    }
    if (newParams.toString() != "") {
        history.pushState({ cleared: key }, `cleared ${key}`, window.location.href.split("?")[0] + "?" + newParams.toString());
    } else {
        history.pushState({ cleared: key }, `cleared ${key}`, window.location.href.split("?")[0]);
    }
}

function clearParams() {
    newParams = getParams();
    for (param of newParams) {
        clearParam(param);
    }
}

function checkParam(key, value) {
    params = getParams();
    return params.has(key) && params.get(key) == value;
}

function rands(length) {
    let chars = "acbdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function array_remove(array, item) {
    if (array.indexOf(item) > -1) {
        array.splice(array.indexOf(item), 1);
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|\[\]\\]/g, "\\$&");
}

function copyText(string) {
    if (navigator) {
        navigator.clipboard.writeText(string).then(
            () => {
                console.debug("copied text");
            },
            () => {
                console.warn("failed to copy text");
            }
        );
    } else {
        let textArea = cel("textarea");
        textArea.style.position = "absolute";
        textArea.style.top = textArea.style.left = "-9999px";
        textArea.style.width = textArea.style.height = "0px";
        textArea.style.opacity = "0";
        textArea.value = string;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        console.debug("copied text");
    }
}

function downloadText(string, filename = "file.txt") {
    // let a = celfs(
    //     `<a href="data:application/octet-stream;charset=utf-16le;base64,${atob(JSON.stringify({ items: loadedItems }))}"></a>`
    // );

    let blob = new Blob([string], { type: "text/plain" });
    let a = cel("a");
    a.download = filename;
    a.href = URL.createObjectURL(blob);
    a.dataset.downloadUrl = ["text/plain", a.download, a.href].join(":"); // ?????????
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
    }, 2000);
}

function downloadFile(data, filename, type) {
    let file = new Blob([data], { type: type });
    if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(file, filename);
    } else {
        let a = document.createElement("a");
        let url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 100);
    }
}

function tableify(object, parent, usePlaceholders = true, simplify = false) {
    if (typeof object === "object" && object !== null) {
        let tbody = cel("tbody");
        let table = cel("table", tbody, ["property-table", simplify ? "simplified" : null]);

        for (const [key, value] of Object.entries(object)) {
            let path = parent
                ? parseInt(key) || key == 0
                    ? parent + "[" + key + "]"
                    : parent + "." + key
                : parseInt(key) || key == 0
                ? "[" + key + "]"
                : key;
            let row = cel("tr", null, "property");

            let keyContainer = cel(
                "td",
                simplify
                    ? key.replace(/_/g, " ").replace(/(?:^|\s)(.)/g, function (x) {
                          return x.toUpperCase();
                      })
                    : key,
                ["key", parseInt(key) || key == 0 ? "index" : null]
            );
            keyContainer.title = path;

            let valueContainer = cel("td", null, "value");
            valueContainer.title =
                JSON.stringify(value).length > 100 ? JSON.stringify(value).substring(0, 97) + "..." : JSON.stringify(value);

            let valueExpandable = celwa("a", [["href", "javascript:void(0);"]], null, "placeholder");

            keyContainer.onclick = () => {
                if (row.classList.contains("expanded")) {
                    valueContainer.innerHTML = "";
                    valueContainer.appendChild(valueExpandable);
                    row.classList.remove("expanded");
                }
            };

            valueExpandable.onclick = () => {
                valueContainer.innerHTML = "";
                valueContainer.appendChild(tableify(value, path, usePlaceholders, simplify));
                row.classList.add("expanded");
            };

            if (Array.isArray(value)) {
                row.classList.add("expandable");
                row.classList.add("array");
                if (value.length != 0) {
                    valueExpandable.innerHTML = "[...] " + value.length + " item" + (value.length == 1 ? "" : "s");
                    row.classList.add("populated");
                } else {
                    valueExpandable.innerHTML = "[] empty";
                    row.classList.add("empty");
                }
                if (usePlaceholders) {
                    valueContainer.innerHTML = "";
                    valueContainer.appendChild(valueExpandable);
                } else {
                    row.classList.add("expanded");
                    valueContainer.innerHTML = "";
                    valueContainer.appendChild(tableify(value, path, usePlaceholders, simplify));
                }
            } else if (typeof value === "object" && value !== null) {
                row.classList.add("expandable");
                row.classList.add("object");
                if (Object.keys(value).length != 0) {
                    valueExpandable.innerHTML =
                        "{...} " + Object.keys(value).length + " key" + (Object.keys(value).length == 1 ? "" : "s");
                    row.classList.add("populated");
                } else {
                    valueExpandable.innerHTML = "{} empty";
                    row.classList.add("empty");
                }
                if (usePlaceholders) {
                    valueContainer.innerHTML = "";
                    valueContainer.appendChild(valueExpandable);
                } else {
                    row.classList.add("expanded");
                    valueContainer.innerHTML = "";
                    valueContainer.appendChild(tableify(value, path, usePlaceholders, simplify));
                }
            } else if (value === null) {
                row.classList.add("null");
            } else if (typeof value === "boolean") {
                row.classList.add("boolean");
                row.classList.add(value);
                valueContainer.innerHTML = value;
            } else if (typeof value === "string") {
                row.classList.add("string");
                if (value.length > 0) {
                    row.classList.add("populated");
                } else {
                    row.classList.add("empty");
                }
                valueContainer.innerHTML = value.replace(/\n/g, "<br>");
                // if (value.match(/^https?:\/\/\S+$/i)) {
                //     valueContainer.innerHTML = `<a href="${value}" target="_blank">${value}</a>`;
                // } else if (value.match(/^#[a-f0-9]{8}|#[a-f0-9]{6}|#[a-f0-9]{3}$/i)) {
                //     valueContainer.innerHTML = `<span class="color" style="color: ${value};"><span class="color-reset" style="color: #000; font-weight: bold;">${value}</span></span>`;
                // }
                valueContainer.innerHTML = valueContainer.innerHTML.replace(/(https?:\/\/[^\s<>]+)/g, `<a href="$1">$1</a>`);
            } else if (Number.isInteger(value)) {
                row.classList.add("number");
                row.classList.add("integer");
                valueContainer.innerHTML = value;
            } else if (!Number.isNaN(value)) {
                row.classList.add("number");
                row.classList.add("float");
                valueContainer.innerHTML = value;
            } else {
                valueContainer.innerHTML = value;
            }

            row.appendChild(keyContainer);
            row.appendChild(valueContainer);
            tbody.appendChild(row);
        }
        return table;
    } else {
        return object;
    }
}

function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sliceArray(array, chunkSize) {
    const newArray = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        newArray.push(chunk);
    }
    return newArray;
}

// function ajaxSubmitForm(form, loaded, error) {
//     const XHR = new XMLHttpRequest();
//     const FD = new FormData(form);

//     XHR.addEventListener("load", (event) => {
//         if (XHR.status.toString()[0] != "2") {
//             throw "non-2xx status code";
//         }
//         console.log("form submission loaded");
//         loaded(event);
//     });

//     XHR.addEventListener("error", (event) => {
//         console.error("form submission failed");
//         error(event);
//     });

//     XHR.open("POST", form.action);
//     XHR.send(FD);
// }

function ajaxSubmitForm(form) {
    return fetch(form.action, { method: "POST", body: new FormData(form) });
}

function setCookie(key, value, expiration = 1, path = "/") {
    let expires = "";
    if (expiration) {
        let date = new Date();
        date.setTime(date.getTime() + expiration * 24 * 60 * 60 * 1000);
        expires = "; expires" + date.toUTCString();
    }
    document.cookie = key + "=" + (value || "") + expires + "; path=" + path;
}

// function getCookie(key) {
//     let keyPair = key + "=";
//     document.cookie.split(";").forEach((c) => {
//         while (c.charAt(0) == " ") c = c.substring(1, c.length);
//         if (c.indexOf(keyPair) == 0) return c.substring(keyPair.length, c.length);
//     });
//     return null;
// }

function getCookie(key) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${key}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
}

function getCookies() {
    let pairs = document.cookie.split(";");
    let cookies = {};
    pairs.forEach((c) => {
        c = c.split("=");
        cookies[(c[0] + "").trim()] = unescape(c.slice(1).join("="));
    });
    return cookies;
}

function deleteCookie(key) {
    document.cookie = key + "=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}

function deleteCookies() {
    let cookies = document.cookie.split(";");
    cookies.forEach((c) => {
        let pos = c.indexOf("=");
        let name = pos > -1 ? c.substr(0, pos) : c;
        document.cookie = name + "=; expires Thu, 01 Jan 1970 00:00:01 GMT";
    });
}

function time() {
    return (Date.now() / 1000) | 0;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHTML(string) {
    return new DOMParser().parseFromString(string, "text/html").documentElement.textContent;
}

function getPos(element) {
    let box = element.getBoundingClientRect();

    let scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    let scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;

    let clientTop = document.documentElement.clientTop || document.body.clientTop || 0;
    let clientLeft = document.documentElement.clientLeft || document.body.clientLeft || 0;

    let top = box.top + scrollTop - clientTop;
    let left = box.left + scrollLeft - clientLeft;

    return [Math.round(top), Math.round(left)];
}

function setDraggable(element, dragHandle) {
    if (!dragHandle) dragHandle = element;
    let pos1,
        pos2,
        pos3,
        pos4 = 0;
    dragHandle.onmousedown = dragDown;
    function dragDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDrag;
        document.onmousemove = drag;
        element.classList.add("dragging");
    }
    function drag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = element.offsetTop - pos2 + "px";
        element.style.left = element.offsetLeft - pos1 + "px";
    }
    function closeDrag(e) {
        document.onmouseup = null;
        document.onmousemove = null;
        element.classList.remove("dragging");
    }
}

function openDialog(dialog, top, left, draggable, dragHandle, closeButton, uniqueClassName) {
    document.body.querySelectorAll("." + uniqueClassName).forEach((element) => element.remove());

    dialog.classList.add("dialog-menu");
    dialog.classList.add(uniqueClassName);

    dialog.style.position = "absolute";
    dialog.style.top = top + "px";
    dialog.style.left = left + "px";

    if (draggable && dragHandle) setDraggable(dialog, dragHandle);
    if (closeButton) closeButton.onclick = () => dialog.remove();

    document.body.appendChild(dialog);
}
