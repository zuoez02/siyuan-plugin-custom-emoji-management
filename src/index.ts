import { Plugin, Menu, Dialog, showMessage, confirm, getFrontend } from 'siyuan';

export default class MoreIconPlugin extends Plugin {
  config = {
    path: "/data/emojis",
    icons: [],
  };

  isMobile: boolean;

  fn = (e) => this.showIconMenu(e);

  onload() {
    this.loadStorage();

    this.addCommand({
      langKey: "refreshEmojis",
      hotkey: "⇧⌘M",
      callback: () => {
        this.refresh();
      },
    });

    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

    const topBarElement = this.addTopBar({
      icon: "iconImgDown",
      title: this.i18n.addTopBarIcon,
      position: "right",
      callback: () => {
        if (this.isMobile) {
          this.showIconMenu();
        } else {
          let rect = topBarElement.getBoundingClientRect();
          // 如果被隐藏，则使用更多按钮
          if (rect.width === 0) {
            rect = document.querySelector("#barMore").getBoundingClientRect();
          }
          if (rect.width === 0) {
            rect = document
              .querySelector("#barPlugins")
              .getBoundingClientRect();
          }
          this.showIconMenu(rect);
        }
      },
    });
  }

  refresh() {
    fetch("/api/system/getEmojiConf", { method: "POST", body: "{}" })
      .then((res) => res.json())
      .then((response) => {
        window.siyuan.emojis = response.data;
      });
  }

  async loadStorage() {
    const data = await this.loadData("config.json");
    if (!data) {
      this.saveData("config.json", JSON.stringify(this.config));
    } else {
      Object.assign(this.config, data);
    }
  }

  showIconMenu(rect = null) {
    const m = new Menu("MoreIconMenu");
    m.addItem({
      label: this.i18n.setLink,
      icon: "iconImgDown",
      click: () => this.addOutlinkIcon(),
    });
    m.open({ x: rect.x, y: rect.y });
  }

  async addOutlinkIcon() {
    const files = await fetch("/api/file/readDir", {
      method: "POST",
      body: JSON.stringify({ path: this.config.path }),
    })
      .then((res) => res.json())
      .then((res) => res.data.map((f) => f.name));
    const dialog = new Dialog({
      content: `
              <div style="padding: 20px">
                  <input class="b3-text-field" style="width: 400px" placeholder="${this.i18n.placeholder}">
                  <button class="confirm b3-button">${
                    this.i18n.confirm
                  }</button>
                  <button class="clear b3-button">${this.i18n.clear}</button>
                  <div>
                    ${files
                      .map((name) => {
                        return `<div class="item" data-filename="${name}">${name} <button class="remove b3-button b3-button--outline">${this.i18n.removeFile}</button></div>`;
                      })
                      .join("")}
                  </div>
              </div>
              `,
    });
    const input = dialog.element.querySelector("input");
    input.value = "";
    const button = dialog.element.querySelector(".confirm");
    button.addEventListener("click", (e) => {
      const val = input.value;
      this.downloadIcon(val).then(() => {
        this.refresh();
        dialog.destroy();
      });
    });
    const button2 = dialog.element.querySelector(".clear");
    button2.addEventListener("click", (e) => {
      input.value = "";
    });
    const removes = dialog.element.querySelectorAll(".item");
    removes.forEach((re) => {
      re.querySelector(".remove").addEventListener("click", () => {
        const name = re.getAttribute("data-filename")
        confirm(
          "⚠️",
          this.i18n.confirmRemove.replace("${name}", name),
          () => {
            fetch("/api/file/removeFile", {
              method: "POST",
              body: JSON.stringify({
                path: `/data/emojis/${name}`,
              }),
            })
              .then((res) => res.json())
              .then((d) => {
                if (d.code === 0) {
                  showMessage(this.i18n.deleted.replace("${name}", name));
                  re.remove();
                }
              });
          }
        );
      });
    });
  }

  downloadIcon(url) {
    const target = "/data/emojis";
    let type;
    return fetch(url, {
      responseType: "blob",
    })
      .then((res) => {
        type = res.headers.get("Content-Type");
        if (!type || type.split("/")[0] !== "image") {
          showMessage(this.i18n.notImage);
          return null;
        }
        return res.blob();
      })
      .then((blob) => {
        if (!blob) {
          return;
        }
        let last = url.split("/");
        last = last[last.length - 1];
        const name = last.split(".")[0];
        const filename = `${name}.${type.split("/")[1]}`;
        const file = new File([blob], filename);
        const formData = new FormData();
        formData.append("path", `${target}/${filename}`);
        formData.append("isDir", "false");
        formData.append("file", file);
        fetch("/api/file/putFile", {
          body: formData,
          method: "POST",
        })
          .then((res) => res.json())
          .then((res) => {
            if (res.code === 0) {
              showMessage("upload success");
            } else {
              showMessage("upload failed");
            }
          });
      });
  }
};
