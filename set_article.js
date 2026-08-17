const content = $escaped;
const pm = document.querySelector('.ProseMirror');
if (pm) {
  pm.innerText = content;
  pm.dispatchEvent(new Event('input', { bubbles: true }));
  console.log('Content set successfully');
} else {
  console.log('ProseMirror not found');
}
