gels("setting").forEach((element) => {
    let cookie = getCookie("setting_" + element.name);
    if (cookie) {
        if (element.type == "checkbox") {
            element.checked = cookie == "true";
        } else {
            element.value = cookie;
        }
    } else {
        if (element.type == "checkbox") {
            element.checked = element.dataset.default == "true";
        } else {
            element.value = element.dataset.default;
        }
    }
    element.onchange = () => {
        if (element.type == "checkbox") element.value = element.checked;
        setCookie("setting_" + element.name, element.value);
    };
});
