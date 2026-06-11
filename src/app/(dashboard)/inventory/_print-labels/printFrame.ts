export function printHtmlInFrame(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  let printCalled = false;

  const triggerPrint = () => {
    if (printCalled) return;
    printCalled = true;
    setTimeout(() => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 1500);
    }, 200);
  };

  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    iframe.onload = () => {
      triggerPrint();
    };
    setTimeout(() => {
      if (iframeDoc.readyState === "complete" && !printCalled) {
        triggerPrint();
      }
    }, 1000);
  }
}
