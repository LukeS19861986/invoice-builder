(() => {
  "use strict";
  // PDF dependencies are checked at export time so the editor still works offline.
  let logoLoading = false;

  const $ = id => document.getElementById(id);
  const profession = $("profession"), startButton = $("startButton"), builder = $("builder"),
        previewSection = $("previewSection"), resetButton = $("resetButton"), addItemButton = $("addItemButton"),
        itemsList = $("itemsList"), previewButton = $("previewButton"), editButton = $("editButton"),
        downloadButton = $("downloadButton"), logoInput = $("logoInput"), logoLabel = $("logoLabel"),
        accentColor = $("accentColor"), currency = $("currency"), taxRate = $("taxRate"), discount = $("discount"),
        invoiceNumber = $("invoiceNumber"), invoiceDate = $("invoiceDate"), dueDate = $("dueDate");

  let rows = [];
  let logoDataUrl = "";
  let selectedProfession = "freelancer";

  const professionProfiles = {
    freelancer: {
      label: "INDEPENDENT SERVICES",
      defaults: ["Professional services", "Project fee", "Additional services"]
    },
    photographer: {
      label: "PHOTOGRAPHY SERVICES",
      defaults: ["Photography session", "Editing / retouching", "Usage / licensing"]
    },
    consultant: {
      label: "CONSULTING SERVICES",
      defaults: ["Consulting services", "Project advisory", "Hourly consulting"]
    },
    builder: {
      label: "TRADE SERVICES",
      defaults: ["Labour", "Materials", "Site work / call-out"]
    },
    designer: {
      label: "CREATIVE SERVICES",
      defaults: ["Design services", "Creative development", "Artwork / production"]
    },
    tutor: {
      label: "EDUCATION SERVICES",
      defaults: ["Tuition", "Lesson / session", "Course materials"]
    },
    musician: {
      label: "MUSIC SERVICES",
      defaults: ["Performance fee", "Session work", "Production / rehearsal"]
    },
    other: {
      label: "PROFESSIONAL SERVICES",
      defaults: ["Services", "Project work", "Additional services"]
    }
  };

  const professionDefaults = Object.fromEntries(
    Object.entries(professionProfiles).map(([key, profile]) => [key, profile.defaults])
  );

  const currencyMap = {
    ZAR: { symbol:"R", locale:"en-ZA" },
    USD: { symbol:"$", locale:"en-US" },
    EUR: { symbol:"€", locale:"en-IE" },
    GBP: { symbol:"£", locale:"en-GB" },
    AUD: { symbol:"A$", locale:"en-AU" },
    CAD: { symbol:"C$", locale:"en-CA" }
  };

  function money(value){
    const c = currencyMap[currency.value] || currencyMap.ZAR;
    return `${c.symbol}${Number(value || 0).toLocaleString(c.locale,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  }

  function todayISO(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function addDaysISO(days){ const d=new Date(); d.setDate(d.getDate()+days); return todayISO(d); }
  function displayDate(value){
    if(!value) return "";
    const d=new Date(value+"T00:00:00");
    return d.toLocaleDateString("en-ZA",{day:"2-digit",month:"short",year:"numeric"});
  }

  function newInvoiceNumber(){
    const d=new Date();
    return `INV-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>b.toString(16).padStart(2,"0")).join("").toUpperCase()}`;
  }

  function addRow(description=""){
    rows.push({id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()), description, qty:1, rate:0});
    renderRows();
  }

  function renderRows(){
    itemsList.innerHTML="";
    rows.forEach((row,index)=>{
      const el=document.createElement("div");
      el.className="item-row";
      el.innerHTML = `
        <textarea class="item-desc" aria-label="Description" rows="2" required placeholder="Description"></textarea>
        <input class="item-qty" aria-label="Quantity" type="number" min="0.0001" max="1000000" step="0.0001" required>
        <input class="item-rate" aria-label="Rate" type="number" min="0" max="1000000000" step="0.01" required>
        <div class="item-amount"></div>
        <button class="remove-item" type="button" aria-label="Remove item">×</button>`;
      const desc=el.querySelector("textarea"), qty=el.querySelector(".item-qty"), rate=el.querySelector(".item-rate");
      desc.value=row.description; qty.value=row.qty; rate.value=row.rate;
      const amount=()=>{ el.querySelector(".item-amount").textContent=money(lineCents(row)/100); };
      amount();
      desc.addEventListener("input",e=>{row.description=e.target.value;});
      qty.addEventListener("input",e=>{row.qty=e.target.value; amount();});
      rate.addEventListener("input",e=>{row.rate=e.target.value; amount();});
      el.querySelector(".remove-item").addEventListener("click",()=>{ if(rows.length>1){ rows.splice(index,1); renderRows(); }});
      itemsList.appendChild(el);
    });
  }

  function gather(){
    return {
      profession:selectedProfession,
      fromName:$("fromName").value.trim(),
      fromEmail:$("fromEmail").value.trim(),
      fromPhone:$("fromPhone").value.trim(),
      fromReg:$("fromReg").value.trim(),
      fromVat:$("fromVat").value.trim(),
      fromAddress:$("fromAddress").value.trim(),
      clientName:$("clientName").value.trim(),
      clientEmail:$("clientEmail").value.trim(),
      clientAddress:$("clientAddress").value.trim(),
      invoiceNumber:invoiceNumber.value.trim(),
      invoiceDate:invoiceDate.value,
      dueDate:dueDate.value,
      currency:currency.value,
      taxRate:parseFloat(taxRate.value)||0,
      discount:parseFloat(discount.value)||0,
      payment:$("paymentDetails").value.trim(),
      notes:$("notes").value.trim(),
      accent:accentColor.value,
      logo:logoDataUrl,
      items:rows.map(r=>({...r}))
    };
  }

  // Quantities: four decimal places; monetary inputs: cents. Round each line
  // half up before summing, then apply the amount discount and round tax once.
  function scaled(value, places){
    if(!/^\d+(?:\.\d+)?$/.test(String(value || "0"))) return 0;
    const [whole, fraction=""]=String(value || "0").split(".");
    const result=Number(whole)*10**places + Number((fraction+"0".repeat(places)).slice(0,places));
    return Number.isSafeInteger(result)?result:0;
  }
  function lineCents(row){
    const q=BigInt(scaled(row.qty,4)), r=BigInt(scaled(row.rate,2));
    return Number((q*r+5000n)/10000n);
  }
  function totals(data){
    const subtotalCents=data.items.reduce((sum,r)=>sum+lineCents(r),0);
    const discountCents=scaled(data.discount,2);
    const taxable=subtotalCents-discountCents;
    const taxCents=Number((BigInt(taxable)*BigInt(scaled(data.taxRate,2))+5000n)/10000n);
    return {subtotal:subtotalCents/100,discount:discountCents/100,tax:taxCents/100,total:(taxable+taxCents)/100};
  }

  function validate(){
    if(logoLoading){ alert("Please wait for the logo to finish processing."); return false; }
    for(const el of builder.querySelectorAll("input:not([type=file]), textarea")){
      el.setCustomValidity("");
      if(el.required && !el.value.trim()) el.setCustomValidity("Please complete this field.");
      if(el.type==="number" && !/^\d+(?:\.\d+)?$/.test(el.value)) el.setCustomValidity("Enter a non-negative decimal number.");
    }
    if(dueDate.value && invoiceDate.value && dueDate.value<invoiceDate.value) dueDate.setCustomValidity("Due date must be on or after the invoice date.");
    const data=gather();
    if(data.items.reduce((s,r)=>s+lineCents(r),0)>1000000000000){ alert("Invoice subtotal is too large. Please keep it below 10 billion currency units."); return false; }
    if(Number(discount.value)>data.items.reduce((s,r)=>s+lineCents(r),0)/100) discount.setCustomValidity("Discount cannot exceed the subtotal.");
    const bad=Array.from(builder.querySelectorAll("input,textarea")).find(el=>!el.checkValidity());
    if(bad){ builder.classList.remove("hidden"); previewSection.classList.add("hidden"); bad.focus(); bad.reportValidity(); return false; }
    return true;
  }

  function lines(...parts){ return parts.filter(Boolean).join("\n"); }

  function updatePreview(){
    const data=gather(), t=totals(data);
    const preview=$("invoicePreview");
    preview.style.setProperty("--invoice-accent",data.accent);
    const motif=$("professionMotif");
    motif.style.color=data.accent;
    preview.className = `invoice-preview profession-${data.profession}`;
    $("previewProfessionLabel").textContent = (professionProfiles[data.profession] || professionProfiles.other).label;

    $("previewFromName").textContent=data.fromName || "Your business";
    $("previewFromDetails").textContent=lines(data.fromEmail,data.fromPhone,data.fromReg?`Registration: ${data.fromReg}`:"",data.fromVat?`VAT: ${data.fromVat}`:"",data.fromAddress);
    $("previewClientName").textContent=data.clientName || "Client name";
    $("previewClientDetails").textContent=lines(data.clientEmail,data.clientAddress);
    $("previewInvoiceNumber").textContent=data.invoiceNumber ? `#${data.invoiceNumber}` : "#";
    $("previewDate").textContent=displayDate(data.invoiceDate);
    $("previewDueDate").textContent=displayDate(data.dueDate);

    const pItems=$("previewItems");
    pItems.innerHTML="";
    data.items.forEach(r=>{
      const row=document.createElement("div"); row.className="preview-row";
      [r.description,String(r.qty),money(r.rate),money(lineCents(r)/100)].forEach(text=>{ const cell=document.createElement("span"); cell.textContent=text; row.appendChild(cell); });
      pItems.appendChild(row);
    });

    $("previewSubtotal").textContent=money(t.subtotal);
    $("previewDiscount").textContent=`− ${money(t.discount)}`;
    $("previewTax").textContent=money(t.tax);
    $("previewTotal").textContent=money(t.total);
    $("previewDiscountRow").classList.toggle("hidden",t.discount<=0);
    $("previewTaxRow").classList.toggle("hidden",t.tax<=0);

    $("previewPayment").textContent=data.payment;
    $("previewNotes").textContent=data.notes;
    $("previewPaymentBlock").classList.toggle("hidden",!data.payment);
    $("previewNotesBlock").classList.toggle("hidden",!data.notes);

    const img=$("previewLogo");
    if(data.logo){ img.src=data.logo; img.classList.remove("hidden"); } else { img.classList.add("hidden"); img.removeAttribute("src"); }
  }

  function hexToRgb(hex){
    const h=hex.replace("#","");
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
  }

  function fitText(doc,text,maxWidth){
    return doc.splitTextToSize(text || "",maxWidth);
  }

  function tint(rgb, amount=.82){
    return rgb.map(v => Math.round(v + (255-v)*amount));
  }

  function drawProfessionMotif(doc, profession, accent){
    const [ar,ag,ab]=accent;
    const light=tint(accent,.90);
    doc.setDrawColor(...light);
    doc.setFillColor(...light);
    doc.setLineWidth(.28);

    if(profession==="photographer"){
      doc.circle(181,24,13);
      doc.circle(181,24,7.5);
      doc.setLineWidth(.48);
      doc.line(160,10,168,10); doc.line(160,10,160,18);
      doc.line(202,10,194,10); doc.line(202,10,202,18);
      doc.line(160,39,168,39); doc.line(160,39,160,31);
      doc.line(202,39,194,39); doc.line(202,39,202,31);
    } else if(profession==="builder"){
      doc.setLineWidth(.25);
      for(let x=162;x<=204;x+=7) doc.line(x,8,x,43);
      for(let y=8;y<=43;y+=7) doc.line(162,y,204,y);
      doc.setDrawColor(ar,ag,ab); doc.setLineWidth(.55);
      doc.line(163,47,201,47); doc.line(163,44.5,163,49.5); doc.line(201,44.5,201,49.5);
    } else if(profession==="consultant"){
      doc.setLineWidth(.7); doc.line(169,9,169,41);
      doc.setLineWidth(.3); doc.line(176,13,203,13); doc.line(176,21,198,21); doc.line(176,29,204,29); doc.line(176,37,194,37);
    } else if(profession==="designer"){
      doc.setFillColor(...light);
      doc.rect(166,11,17,17,"F");
      doc.triangle(187,11,204,28,187,28,"F");
      doc.circle(175,36,8,"F");
    } else if(profession==="tutor"){
      doc.setLineWidth(.3);
      for(let y=11;y<=41;y+=6) doc.line(163,y,204,y);
      doc.setDrawColor(ar,ag,ab); doc.setLineWidth(.6); doc.rect(163,10,5,5); doc.line(174,13,190,13);
    } else if(profession==="musician"){
      doc.setLineWidth(.3);
      for(let y=11;y<=35;y+=6) doc.line(162,y,204,y);
      doc.setFillColor(ar,ag,ab); doc.circle(178,29,2.1,"F"); doc.circle(194,17,2.1,"F");
      doc.setDrawColor(ar,ag,ab); doc.setLineWidth(.6); doc.line(180,29,180,16); doc.line(196,17,196,8);
    } else if(profession==="freelancer"){
      doc.setFillColor(...light); doc.circle(173,17,3,"F"); doc.circle(184,25,3,"F"); doc.circle(195,17,3,"F");
      doc.setDrawColor(...light); doc.setLineWidth(.45); doc.line(173,17,184,25); doc.line(184,25,195,17);
    } else {
      doc.setFillColor(...light); doc.circle(181,22,5,"F"); doc.circle(195,31,3,"F");
    }
  }

  async function downloadPdf(){
    if(!validate()) return;
    const jsPDF=window.jspdf?.jsPDF;
    if(!jsPDF || !jsPDF.API.autoTable){ alert("PDF libraries could not load. Check your connection and reload before downloading."); return; }
    updatePreview();
    const data=gather(), t=totals(data);
    const doc=new jsPDF({unit:"mm",format:"a4",orientation:"portrait"});
    const [ar,ag,ab]=hexToRgb(data.accent);
    const dark=[20,27,23], muted=[96,106,100], soft=[221,228,224];
    const left=18, right=192, pageW=210;

    // Profession-aware visual signature: noticeable, never decorative enough to distract.
    drawProfessionMotif(doc, data.profession, [ar,ag,ab]);

    // Flowing header tables keep long names and addresses clear of the items.
    if(data.logo){
      const props=doc.getImageProperties(data.logo);
      const scale=Math.min(28/props.width,18/props.height);
      doc.addImage(data.logo,"PNG",left,16,props.width*scale,props.height*scale);
    }
    const fromText=lines(data.fromName,data.fromEmail,data.fromPhone,data.fromReg?`Registration: ${data.fromReg}`:"",data.fromVat?`VAT: ${data.fromVat}`:"",data.fromAddress);
    const tableBase={theme:"plain",margin:{left,right:18,top:18,bottom:22},styles:{font:"helvetica",fontSize:9,cellPadding:2,overflow:"linebreak",textColor:dark}};
    doc.autoTable({...tableBase,startY:data.logo?39:18,body:[[fromText,lines("INVOICE",`#${data.invoiceNumber}`,(professionProfiles[data.profession] || professionProfiles.other).label)]],columnStyles:{0:{cellWidth:100},1:{cellWidth:74,halign:"right"}}});
    let headerEnd=doc.lastAutoTable.finalY;
    doc.setDrawColor(ar,ag,ab); doc.line(left,headerEnd+3,right,headerEnd+3);
    doc.autoTable({...tableBase,startY:headerEnd+8,body:[[lines("BILL TO",data.clientName,data.clientEmail,data.clientAddress),lines(`Date: ${displayDate(data.invoiceDate)}`,`Due: ${displayDate(data.dueDate)}`)]],columnStyles:{0:{cellWidth:110},1:{cellWidth:64,halign:"right"}}});
    const itemsY=doc.lastAutoTable.finalY+8;

    const body=data.items.map(r=>[r.description||"Service",String(r.qty),money(r.rate),money(lineCents(r)/100)]);
    doc.autoTable({
      startY:itemsY,
      margin:{left,right:18,top:18,bottom:22},
      rowPageBreak:"avoid",
      showHead:"everyPage",
      head:[["Description","Qty","Rate","Amount"]],
      body,
      styles:{font:"helvetica",fontSize:8.35,textColor:dark,cellPadding:{top:3.5,right:3.2,bottom:3.5,left:3.2},lineColor:[232,237,234],lineWidth:{bottom:.12}},
      headStyles:{fillColor:[255,255,255],textColor:muted,fontStyle:"bold",fontSize:7.15,lineColor:[196,207,201],lineWidth:{bottom:.28},cellPadding:{top:3.2,right:3.2,bottom:4.4,left:3.2}},
      columnStyles:{0:{cellWidth:92},1:{halign:"right",cellWidth:18},2:{halign:"right",cellWidth:30},3:{halign:"right",cellWidth:34}},
      theme:"plain"
    });

    let y=doc.lastAutoTable.finalY+11.5;
    if(y+36>274){ doc.addPage(); y=25; }
    const labelX=130, valX=192;
    doc.setFontSize(8.15); doc.setFont("helvetica","normal"); doc.setTextColor(...muted);
    doc.text("Subtotal",labelX,y); doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.text(money(t.subtotal),valX,y,{align:"right"});
    if(t.discount>0){ y+=7; doc.setTextColor(...muted); doc.setFont("helvetica","normal"); doc.text("Discount",labelX,y); doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.text(`- ${money(t.discount)}`,valX,y,{align:"right"}); }
    if(t.tax>0){ y+=7; doc.setTextColor(...muted); doc.setFont("helvetica","normal"); doc.text(`Tax (${data.taxRate}%)`,labelX,y); doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.text(money(t.tax),valX,y,{align:"right"}); }
    y+=9.5; doc.setDrawColor(ar,ag,ab); doc.setLineWidth(.48); doc.line(labelX,y-4.8,valX,y-4.8);
    doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.setFontSize(11.7); doc.text("Total",labelX,y); doc.setTextColor(ar,ag,ab); doc.text(money(t.total),valX,y,{align:"right"});

    // AutoTable paginates arbitrary payment/notes text, including a single
    // block longer than a page. Both blocks start below the complete totals.
    const noteBody=[];
    if(data.payment) noteBody.push(["PAYMENT DETAILS",data.payment]);
    if(data.notes) noteBody.push(["NOTES",data.notes]);
    if(noteBody.length) doc.autoTable({...tableBase,startY:y+14,body:noteBody,columnStyles:{0:{cellWidth:32,fontStyle:"bold",textColor:muted},1:{cellWidth:142}}});
    const pages=doc.getNumberOfPages();
    for(let page=1;page<=pages;page++){
      doc.setPage(page);
      doc.setDrawColor(230,235,232); doc.setLineWidth(.22); doc.line(left,282,right,282);
      doc.setFont("helvetica","normal"); doc.setFontSize(6.15); doc.setTextColor(145,154,149);
      doc.text(`Created privately in your browser with InvoiceCreator | ${page} / ${pages}`,105,287,{align:"center"});
    }

    const safe=(data.clientName || "invoice").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase();
    doc.save(`${safe || "invoice"}.pdf`);
  }

  function initialise(){
    invoiceNumber.value=newInvoiceNumber();
    invoiceDate.value=todayISO();
    dueDate.value=addDaysISO(7);
    selectedProfession=profession.value;
    rows=[];
    addRow(professionDefaults[selectedProfession][0]);
    $("notes").value="Thank you for your business.";
  }

  startButton.addEventListener("click",()=>{
    selectedProfession=profession.value;
    if(rows.length===1 && !rows[0].description) rows[0].description=professionDefaults[selectedProfession][0];
    builder.classList.remove("hidden");
    builder.scrollIntoView({behavior:"smooth"});
  });

  profession.addEventListener("change",()=>{
    selectedProfession=profession.value;
    if(rows.length===1 && (!rows[0].description || Object.values(professionDefaults).flat().includes(rows[0].description))){
      rows[0].description=professionDefaults[selectedProfession][0]; renderRows();
    }
  });

  let logoVersion=0;
  async function normaliseLogo(file){
    if(!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size>4*1024*1024) throw new Error("Choose a PNG, JPEG or WebP logo smaller than 4 MB.");
    const url=URL.createObjectURL(file);
    try{
      const image=new Image(); image.src=url; await image.decode();
      if(!image.width || !image.height || image.width*image.height>40000000) throw new Error("Logo dimensions are too large. Please resize the image.");
      const scale=Math.min(1,600/image.width,600/image.height), canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(image.width*scale)); canvas.height=Math.max(1,Math.round(image.height*scale));
      canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
      return canvas.toDataURL("image/png");
    }finally{ URL.revokeObjectURL(url); }
  }
  logoInput.addEventListener("change",async()=>{
    const file=logoInput.files?.[0]; if(!file) return;
    const version=++logoVersion; logoLoading=true;
    try{ const logo=await normaliseLogo(file); if(version!==logoVersion) return; logoDataUrl=logo; logoLabel.textContent=file.name; }
    catch(e){ if(version===logoVersion) alert(e.message || "This logo could not be read. Please choose another image."); }
    finally{ if(version===logoVersion){logoLoading=false; logoInput.value="";} }
  });
  $("removeLogoButton").addEventListener("click",()=>{ ++logoVersion; logoLoading=false; logoDataUrl=""; logoInput.value=""; logoLabel.textContent="Choose image"; });

  addItemButton.addEventListener("click",()=>addRow(""));
  function currencyChanged(){ renderRows(); $("discountLabel").textContent=`Discount amount (${currency.value})`; }
  currency.addEventListener("change",currencyChanged);

  previewButton.addEventListener("click",()=>{
    if(!validate()) return;
    updatePreview();
    builder.classList.add("hidden");
    previewSection.classList.remove("hidden");
    previewSection.scrollIntoView({behavior:"smooth"});
  });

  editButton.addEventListener("click",()=>{
    previewSection.classList.add("hidden");
    builder.classList.remove("hidden");
    builder.scrollIntoView({behavior:"smooth"});
  });

  downloadButton.addEventListener("click",()=>downloadPdf().catch(()=>alert("The PDF could not be created. Please check your invoice and try again.")));
  resetButton.addEventListener("click",()=>{
    if(confirm("Start a new invoice?")){
      document.querySelectorAll("input,textarea").forEach(el=>{ if(!["color","date"].includes(el.type)) el.value=""; });
      ++logoVersion; logoLoading=false; logoDataUrl=""; logoInput.value=""; logoLabel.textContent="Choose image"; accentColor.value="#2f6f57";
      currency.value="ZAR"; taxRate.value="0"; discount.value="0"; $("paymentDetails").value=""; $("notes").value="Thank you for your business.";
      initialise();
      restoreBusiness(); currencyChanged();
      previewSection.classList.add("hidden"); builder.classList.remove("hidden");
      window.scrollTo({top:0,behavior:"smooth"});
    }
  });

  const businessKey="invoicecreator.business.v1";
  const businessFields=["fromName","fromEmail","fromPhone","fromReg","fromVat","fromAddress","paymentDetails"];
  const remember=$("rememberBusiness"), memoryStatus=$("memoryStatus");
  function saveBusiness(){
    if(!remember.checked) return;
    try{
      const fields=Object.fromEntries(businessFields.map(id=>[id,$(id).value]));
      localStorage.setItem(businessKey,JSON.stringify({version:1,fields,logo:logoDataUrl}));
      memoryStatus.textContent="Business details saved on this device. Client details are not saved.";
    }catch{ memoryStatus.textContent="Business details could not be saved. Device storage may be blocked or full."; }
  }
  function forgetBusiness(){
    try{ localStorage.removeItem(businessKey); remember.checked=false; memoryStatus.textContent="Saved business details cleared. The current invoice is still open."; }
    catch{ memoryStatus.textContent="Unable to clear device storage. Clear this site's data in your browser settings."; }
  }
  function restoreBusiness(){
    try{
      const saved=JSON.parse(localStorage.getItem(businessKey)||"null");
      if(saved?.version!==1 || !saved.fields) return;
      businessFields.forEach(id=>{ if(typeof saved.fields[id]==="string") $(id).value=saved.fields[id]; });
      if(typeof saved.logo==="string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(saved.logo) && saved.logo.length<2000000){ logoDataUrl=saved.logo; logoLabel.textContent="Saved business logo"; }
      remember.checked=true; memoryStatus.textContent="Saved business details loaded from this device.";
    }catch{ memoryStatus.textContent="Device storage is unavailable or saved business details could not be read."; }
  }
  remember.addEventListener("change",()=>remember.checked?saveBusiness():forgetBusiness());
  $("clearBusinessButton").addEventListener("click",forgetBusiness);
  businessFields.forEach(id=>$(id).addEventListener("input",saveBusiness));
  // Logo processing is asynchronous: save only after the processed image is ready.
  logoInput.addEventListener("change",async()=>{
    while(logoLoading) await new Promise(resolve=>setTimeout(resolve,30));
    saveBusiness();
  });
  $("removeLogoButton").addEventListener("click",saveBusiness);

  const draftFields={fromName:"fromName",fromEmail:"fromEmail",fromPhone:"fromPhone",fromReg:"fromReg",fromVat:"fromVat",fromAddress:"fromAddress",clientName:"clientName",clientEmail:"clientEmail",clientAddress:"clientAddress",invoiceNumber:"invoiceNumber",invoiceDate:"invoiceDate",dueDate:"dueDate",currency:"currency",taxRate:"taxRate",discount:"discount",payment:"paymentDetails",notes:"notes",accent:"accentColor"};
  $("exportDraftButton").addEventListener("click",()=>{
    if(logoLoading){alert("Please wait for the logo to finish processing.");return;}
    const data=gather();
    // Keep raw numeric inputs so even an unfinished invoice remains editable.
    data.taxRate=taxRate.value; data.discount=discount.value;
    const url=URL.createObjectURL(new Blob([JSON.stringify({type:"invoicecreator-draft",version:1,data},null,2)],{type:"application/json"}));
    const link=document.createElement("a"); link.href=url; link.download="invoice-draft.json"; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $("importDraftInput").addEventListener("change",async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    try{
      if(file.size>3000000) throw new Error();
      const draft=JSON.parse(await file.text()), data=draft.data;
      if(draft.type!=="invoicecreator-draft" || draft.version!==1 || !data || !Array.isArray(data.items) || !data.items.length || data.items.length>500) throw new Error();
      for(const key of Object.keys(draftFields)) if(!["string","number"].includes(typeof data[key]) || String(data[key]).length>50000) throw new Error();
      if(!currencyMap[data.currency] || !professionProfiles[data.profession] || !/^#[a-f0-9]{6}$/i.test(data.accent)) throw new Error();
      if(!data.items.every(r=>r && typeof r.description==="string" && r.description.length<=50000 && [r.qty,r.rate].every(v=>["string","number"].includes(typeof v) && String(v).length<30 && (v==="" || /^\d+(?:\.\d+)?$/.test(String(v)))))) throw new Error();
      if(typeof data.logo!=="string" || (data.logo && (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.logo) || data.logo.length>2000000))) throw new Error();
      let logo="";
      if(data.logo){
        const raw=atob(data.logo.split(",")[1]);
        logo=await normaliseLogo(new File([Uint8Array.from(raw,c=>c.charCodeAt(0))],"draft-logo.png",{type:"image/png"}));
      }
      if(!confirm("Replace the current invoice with this local draft?")) return;
      ++logoVersion; logoLoading=false;
      Object.entries(draftFields).forEach(([key,id])=>$(id).value=data[key]);
      profession.value=data.profession; selectedProfession=data.profession;
      rows=data.items.map(r=>({description:r.description,qty:r.qty,rate:r.rate}));
      logoDataUrl=logo; logoLabel.textContent=logo?"Draft logo":"Choose image";
      remember.checked=false; memoryStatus.textContent="Draft loaded. Imported business details will only be remembered if you opt in again.";
      currencyChanged(); previewSection.classList.add("hidden"); builder.classList.remove("hidden");
    }catch{ alert("This draft could not be read. Choose an InvoiceCreator JSON draft (up to 3 MB). The current invoice has not been changed."); }
    finally{ e.target.value=""; }
  });
  $("year").textContent=new Date().getFullYear();
  initialise();
  restoreBusiness();
})();
