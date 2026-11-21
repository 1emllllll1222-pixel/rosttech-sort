const help = document.getElementById("how-to");
const openHelp = document.getElementById("open-help");

openHelp.addEventListener("click", () => help.showModal());
document.getElementById("help-guide").addEventListener("click", () => help.close());

help.addEventListener("click", event => {
  if (event.target !== help) return;
  const bounds = help.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) help.close();
});
