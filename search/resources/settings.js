gels("setting").forEach((element) => {
    let cookie = JSON.parse(getCookie("search_preferences") || "{}");
    if (cookie.hasOwnProperty(element.name)) {
        if (element.type == "checkbox") {
            element.checked = cookie[element.name];
        } else {
            element.value = cookie[element.name];
        }
    } else {
        if (element.type == "checkbox") {
            element.checked = element.dataset.default == "true";
        } else {
            element.value = element.dataset.default;
        }
    }
    element.onchange = () => {
        if (!element.checkValidity()) {
            return;
        }
        let cookie = JSON.parse(getCookie("search_preferences") || "{}");
        let value = element.value;
        if (element.type == "checkbox") {
            value = element.checked;
        } else if (element.type == "number") {
            if (element.step == "1") {
                value = parseInt(element.value);
            } else {
                value = parseFloat(element.value);
            }
        }
        cookie[element.name] = value;
        setCookie("search_preferences", JSON.stringify(cookie));
        console.log(getCookie("search_preferences"));
    };
});
