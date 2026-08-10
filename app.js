(() => {
  "use strict";
  const { jsPDF } = window.jspdf;

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

  function todayISO(d=new Date()){ return d.toISOString().slice(0,10); }
  function addDaysISO(days){ const d=new Date(); d.setDate(d.getDate()+days); return todayISO(d); }
  function displayDate(value){
    if(!value) return "";
    const d=new Date(value+"T00:00:00");
    return d.toLocaleDateString("en-ZA",{day:"2-digit",month:"short",year:"numeric"});
  }

  function newInvoiceNumber(){
    const d=new Date();
    return `INV-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
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
        <input class="item-desc" aria-label="Description" value="${row.description.replaceAll('"','&quot;')}" placeholder="Description">
        <input class="item-qty" aria-label="Quantity" type="number" min="0" step="0.01" value="${row.qty}">
        <input class="item-rate" aria-label="Rate" type="number" min="0" step="0.01" value="${row.rate}">
        <div class="item-amount">${money(row.qty*row.rate)}</div>
        <button class="remove-item" type="button" aria-label="Remove item">×</button>`;
      const [desc,qty,rate] = el.querySelectorAll("input");
      desc.addEventListener("input",e=>{row.description=e.target.value;});
      qty.addEventListener("input",e=>{row.qty=parseFloat(e.target.value)||0; el.querySelector(".item-amount").textContent=money(row.qty*row.rate);});
      rate.addEventListener("input",e=>{row.rate=parseFloat(e.target.value)||0; el.querySelector(".item-amount").textContent=money(row.qty*row.rate);});
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

  function totals(data){
    const subtotal=data.items.reduce((s,r)=>s+(Number(r.qty)||0)*(Number(r.rate)||0),0);
    const discount=Math.min(Math.max(data.discount,0),subtotal);
    const taxable=Math.max(0,subtotal-discount);
    const tax=taxable*(Math.max(data.taxRate,0)/100);
    return {subtotal,discount,tax,total:taxable+tax};
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
    $("previewFromDetails").textContent=lines(data.fromEmail,data.fromPhone,data.fromVat?`VAT / Reg: ${data.fromVat}`:"",data.fromAddress);
    $("previewClientName").textContent=data.clientName || "Client name";
    $("previewClientDetails").textContent=lines(data.clientEmail,data.clientAddress);
    $("previewInvoiceNumber").textContent=data.invoiceNumber ? `#${data.invoiceNumber}` : "#";
    $("previewDate").textContent=displayDate(data.invoiceDate);
    $("previewDueDate").textContent=displayDate(data.dueDate);

    const pItems=$("previewItems");
    pItems.innerHTML="";
    data.items.forEach(r=>{
      const row=document.createElement("div"); row.className="preview-row";
      row.innerHTML=`<span>${r.description || "Service"}</span><span>${r.qty}</span><span>${money(r.rate)}</span><span>${money(r.qty*r.rate)}</span>`;
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
    const light=tint(accent,.84);
    doc.setDrawColor(...light);
    doc.setFillColor(...light);
    doc.setLineWidth(.35);

    if(profession==="photographer"){
      doc.circle(181,24,13);
      doc.circle(181,24,7.5);
      doc.setLineWidth(.7);
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
    updatePreview();
    const data=gather(), t=totals(data);
    const doc=new jsPDF({unit:"mm",format:"a4",orientation:"portrait"});
    const [ar,ag,ab]=hexToRgb(data.accent);
    const dark=[17,23,20], muted=[105,113,109];
    const left=18, right=192, pageW=210;

    // Profession-aware visual signature: noticeable, never decorative enough to distract.
    drawProfessionMotif(doc, data.profession, [ar,ag,ab]);

    if(data.logo){
      try{
        const fmt=data.logo.startsWith("data:image/png")?"PNG":"JPEG";
        doc.addImage(data.logo,fmt,left,16,28,18,undefined,"FAST");
      }catch(e){}
    }

    doc.setTextColor(...dark);
    doc.setFont("helvetica","bold"); doc.setFontSize(17);
    doc.text(data.fromName || "Your business", data.logo?50:left, 24);
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...muted);
    const fromText=lines(data.fromEmail,data.fromPhone,data.fromVat?`VAT / Reg: ${data.fromVat}`:"",data.fromAddress);
    if(fromText) doc.text(fitText(doc,fromText,85),data.logo?50:left,30);

    doc.setTextColor(ar,ag,ab); doc.setFont("helvetica","bold"); doc.setFontSize(11);
    doc.text("INVOICE",right,18,{align:"right"});
    doc.setTextColor(...dark); doc.setFontSize(16);
    doc.text(data.invoiceNumber?`#${data.invoiceNumber}`:"#",right,27,{align:"right"});
    doc.setFont("helvetica","bold"); doc.setFontSize(6.7); doc.setTextColor(...muted);
    doc.text((professionProfiles[data.profession] || professionProfiles.other).label,right,33,{align:"right"});

    doc.setDrawColor(ar,ag,ab); doc.setLineWidth(.65); doc.line(left,43,right,43);

    doc.setFontSize(7.5); doc.setTextColor(...muted); doc.text("BILL TO",left,55);
    doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.text(data.clientName || "Client name",left,62);
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...muted);
    const clientText=lines(data.clientEmail,data.clientAddress);
    if(clientText) doc.text(fitText(doc,clientText,90),left,68);

    doc.setFontSize(8); doc.setTextColor(...muted); doc.text("Date",145,55); doc.text("Due",145,63);
    doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.text(displayDate(data.invoiceDate),right,55,{align:"right"}); doc.text(displayDate(data.dueDate),right,63,{align:"right"});

    const body=data.items.map(r=>[r.description||"Service",String(r.qty),money(r.rate),money(r.qty*r.rate)]);
    doc.autoTable({
      startY:88,
      margin:{left,right:18},
      head:[["Description","Qty","Rate","Amount"]],
      body,
      styles:{font:"helvetica",fontSize:8.5,textColor:dark,cellPadding:3.2,lineColor:[235,239,236],lineWidth:{bottom:.15}},
      headStyles:{fillColor:[255,255,255],textColor:muted,fontStyle:"bold",fontSize:7.5,lineColor:[203,211,207],lineWidth:{bottom:.35}},
      columnStyles:{0:{cellWidth:92},1:{halign:"right",cellWidth:18},2:{halign:"right",cellWidth:30},3:{halign:"right",cellWidth:34}},
      theme:"plain"
    });

    let y=doc.lastAutoTable.finalY+12;
    const labelX=140, valX=192;
    doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(...muted);
    doc.text("Subtotal",labelX,y); doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.text(money(t.subtotal),valX,y,{align:"right"});
    if(t.discount>0){ y+=7; doc.setTextColor(...muted); doc.setFont("helvetica","normal"); doc.text("Discount",labelX,y); doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.text(`- ${money(t.discount)}`,valX,y,{align:"right"}); }
    if(t.tax>0){ y+=7; doc.setTextColor(...muted); doc.setFont("helvetica","normal"); doc.text(`Tax (${data.taxRate}%)`,labelX,y); doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.text(money(t.tax),valX,y,{align:"right"}); }
    y+=10; doc.setDrawColor(ar,ag,ab); doc.setLineWidth(.6); doc.line(labelX,y-5,valX,y-5);
    doc.setTextColor(...dark); doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.text("Total",labelX,y); doc.setTextColor(ar,ag,ab); doc.text(money(t.total),valX,y,{align:"right"});

    let notesY=Math.max(y+22,215);
    if(data.payment){
      doc.setFontSize(7.5); doc.setTextColor(...muted); doc.text("PAYMENT DETAILS",left,notesY);
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...dark); doc.text(fitText(doc,data.payment,77),left,notesY+6);
    }
    if(data.notes){
      doc.setFontSize(7.5); doc.setTextColor(...muted); doc.text("NOTES",110,notesY);
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...dark); doc.text(fitText(doc,data.notes,82),110,notesY+6);
    }

    doc.setDrawColor(236,239,236); doc.setLineWidth(.3); doc.line(left,282,right,282);
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(155,163,159);
    doc.text("Created privately in your browser with InvoiceTool",105,287,{align:"center"});

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

  logoInput.addEventListener("change",()=>{
    const file=logoInput.files?.[0];
    if(!file) return;
    if(file.size>4*1024*1024){ alert("Please choose a logo smaller than 4 MB."); return; }
    const reader=new FileReader();
    reader.onload=()=>{ logoDataUrl=reader.result; logoLabel.textContent=file.name; };
    reader.readAsDataURL(file);
  });

  addItemButton.addEventListener("click",()=>addRow(""));
  currency.addEventListener("change",renderRows);

  previewButton.addEventListener("click",()=>{
    if(!$("fromName").value.trim() || !$("clientName").value.trim()){
      alert("Please add your name/business and the client name first.");
      return;
    }
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

  downloadButton.addEventListener("click",downloadPdf);
  resetButton.addEventListener("click",()=>{
    if(confirm("Start a new invoice?")){
      document.querySelectorAll("input,textarea").forEach(el=>{ if(!["color","date"].includes(el.type)) el.value=""; });
      logoDataUrl=""; logoInput.value=""; logoLabel.textContent="Choose image"; accentColor.value="#2f6f57";
      currency.value="ZAR"; taxRate.value="0"; discount.value="0"; $("paymentDetails").value=""; $("notes").value="Thank you for your business.";
      initialise();
      window.scrollTo({top:0,behavior:"smooth"});
    }
  });

  $("year").textContent=new Date().getFullYear();
  initialise();
})();
