/*
	Berechnet aus JPEG, GIF, PNG Bilden gcode zum Laser-gravieren
	Auflösung: 75 dpi -> Zeilen sind erkennbar 

	optimal Speed F1000 und 8% Laserstärke
	
	Testen ob weniger Speed und Laserstärke geht (F500 & 4% ?)
	
	y-Versprung im Gerät umgehen -->yspezialmove
	
	150dpi testen (OK @500mm/s)
	150dpi testen (OK @800mm/s)
	300dpi testen (OK @500mm/s)
	300dpi testen (OK @800mm/s)
*/


var akPicToLaser=function(zielID){
	var version="1.6 2016-12-17";
	
	var ziel;	
 
	//http://www.shapeoko.com/wiki/index.php/Previewing_G-Code
	//reprap.org/wiki/G-code
	//http://linuxcnc.org/docs/html/gcode.html
 
	//helper
	var cE=function(ziel,e,id,cn,innertext){
			var newNode=document.createElement(e);
			if(id!=undefined && id!="")newNode.id=id;
			if(cn!=undefined && cn!="")newNode.className=cn;
			if(innertext!=undefined && innertext!="")newNode.innerHTML=innertext;
			if(ziel)ziel.appendChild(newNode);
			return newNode;
		}
	var gE=function(id){if(id=="")return undefined; else return document.getElementById(id);}
	var addClass=function(htmlNode,Classe){	
		var newClass;
		if(htmlNode!=undefined){
			newClass=htmlNode.className; 
			if(newClass==undefined || newClass=="")newClass=Classe;
			else
			if(!istClass(htmlNode,Classe))newClass+=' '+Classe; 
			htmlNode.className=newClass;
		}			
	}
	var subClass=function(htmlNode,Classe){
		var aClass,i;
		if(htmlNode!=undefined && htmlNode.className!=undefined){
			aClass=htmlNode.className.split(" ");	
			var newClass="";
			for(i=0;i<aClass.length;i++){
				if(aClass[i]!=Classe){
					if(newClass!="")newClass+=" ";
					newClass+=aClass[i];
					}
			}
			htmlNode.className=newClass;
		}
	}
	var delClass=function(o){
		if(o!=undefined) o.className="";		
	}
	var getClass=function(o){return o.className;}
	var istClass=function(htmlNode,Classe){
		if(htmlNode.className){
			var i,aClass=htmlNode.className.split(' ');
			for(i=0;i<aClass.length;i++){
				if(aClass[i]==Classe)return true;
			}	
		}		
		return false;
	}
	var maF=function(r){return Math.floor(r*100)/100;} //runden mit 2 nachkommastellen
	var maR=function(r){return Math.round(r);}
 
	//--var--
	var inputFile;
	var outPutDoc;
	var inputimage;
	var outputcanvas;
	var makeButt;
	var pauseButt;
 
	var input_Width=undefined;
	var input_Height=undefined;
	var input_FeedBurn=undefined;
	var input_FeedMove=undefined;
	var input_DPI=undefined;
	
	var input_showzielsize=undefined;
 
	var objektdata={
		feedratemin:100,
		feedratemax:2400,
		feedrateburn:500,		//max:2400  800@8% 1000@8%
		feedratemove:500,
		minGrau:200,			//0..255  alles unter minGrau wird zu 0 (nicht lasern)
		Graustufen:7,			//0..255  feine Unterschiede evtl. nicht sichbar, daher reduzieren (rastern)
		width:1,				//mm
		height:1,
		unit:"mm",
		Dlaser:0.125,			//Laserdurchmesser in mm  --> minimaler Zeilenabstand -->max 203,2dpi, sonst Überlappung
		dpi:150,				 //Punkte pro Zoll = Punkte pro 2,54cm
		
		yspezialmove:true,
		timekorr:2.0,			//TODO: /---\
		
		dauer:0,
		//objektdata:false,
		graufunc:"GF",
		timer:undefined,
		stopconvert:false
	}
 
	var createOInputNr=function(ziel,id,inivalue,min,max){
		var htmlNode;
		var value=inivalue;
		var isInt=false;
		
		var create=function(){
			htmlNode=cE(ziel,"input",id);
			htmlNode.name=id;
			htmlNode.type="number";
			htmlNode.step="any";
			htmlNode.min=min;
			htmlNode.max=max;
			//htmlNode.value=inivalue;
			//htmlNode.placeholder ="in mm";
			htmlNode.setAttribute("value",value);
			
			htmlNode.onchange=function(e){
				value=this.value;
				if(isInt)value=Math.floor(value);
			}
		}
		
		this.getvalue=function(){
			return value;
		}
		this.setvalue=function(v){
			value=v;
			if(isInt)value=Math.floor(value);
			htmlNode.value=v;
			htmlNode.setAttribute("value",value);
		}
		this.setclass=function(s){
			htmlNode.className=s;
		}
		
		this.getnode=function(){return htmlNode};
		
		this.setstyle=function(cssatrr,cssvalue){
			htmlNode.style[cssatrr]=cssvalue;
		}
		
		this.setisInt=function(b){
			isInt=b
			if(isInt)htmlNode.step="1";
			}
		
		create();
	}
	
	var createSlider=function(ziel,labeltext,min,max,step,value){		
		var htmlnode=cE(ziel,'label');
		htmlnode.innerHTML=labeltext;
		
		var input=cE(ziel,'input');
		input.className="regler";
		input.type="range";
		input.min=min;
		input.max=max;
		input.step=step;
		input.value=value;
		
		var ocf=function(){
			this.valueview.innerHTML=this.value;
		}
		
		input.addEventListener("change", ocf);//Werteanzeige aktualisieren
		input.addEventListener("click", ocf);
		input.addEventListener("keyup", ocf);
		
		//input.onchange=function(){};//frei für Userfunctionen
			
		
		var htmlnode=cE(ziel,'label');
		htmlnode.innerHTML=input.value;
		htmlnode.className="reglervalue";
		
		input.valueview=htmlnode;
		
		return input;
	}
	
	var createCeckBox=function(ziel,labeltext,ischecked){
		var id="CB_"+labeltext.split(' ').join('');
		var input=cE(ziel,'input');
		input.id=id;
		input.type="checkbox";
		if(ischecked!=undefined)
			input.checked=ischecked;
		else
			input.checked=false;
		
		var label=cE(ziel,'label');
		label.innerHTML=labeltext;
		label.setAttribute("for",id);
		label.onclick=function(){};
		
		return input;
	}
	
	var createRadioBox=function(ziel,name,arrRadios,setfunc){
		var i,r,input,label;
		var radios=[];
		var ocf=function(){
			setfunc(this.value);
		}

		for(i=0;i<arrRadios.length;i++){
			r=arrRadios[i];
			
			input=cE(ziel,'input');
			input.type="radio";
			input.name=name;
			input.value=r.value;
			input.id="RB_"+name+i;
			input.radios=radios;
			if(r.checked!=undefined)input.checked=r.checked;
			input.addEventListener("change", ocf);//Werteanzeige aktualisieren
			
			if(r.text!=undefined){
				label=cE(ziel,'label');
				label.innerHTML=r.text;
				label.setAttribute("for","RB_"+name+i);
				label.onclick=function(){};
			}
			radios.push(input);
			
		}
	}
	
	var ini=function(){
		var html,p,obj;
		
		p=cE(ziel,"p","p_file");
		cE(p,"span",'','',"Bitte Datei wählen: ");
				
		inputFile=cE(p,"input","inputFile");
		inputFile.type="file";
		inputFile.accept="image/*;capture=camera";
		inputFile.size="50";//MB
		inputFile.onchange=handleFile;
		
		inputimage=cE(ziel,"img","inputimage","unsichtbar");
		inputimage.onload=prework;
		
		p=cE(ziel,"p","setdaten","unsichtbar");
		cE(p,"span",'','',"Lasern in einer Größe von&nbsp;");
		
		input_Width=new createOInputNr(p,"input_Width",objektdata.width,1,500);
				
		cE(p,"span",'','',"&nbsp;*&nbsp;");
		
		input_Height=new createOInputNr(p,"input_Height",objektdata.height,1,500);
											
		cE(p,"span",'','',"&nbsp;(Breite * Höhe in "+objektdata.unit+")&nbsp;")
		
		html=cE(p,"a",undefined,"button","set new size");
		html.href="#";
		html.onclick=setNewSize;
		
		cE(p,"br");
		
		cE(p,"span",'','labeltext1',"Feedrate-burn:");
		input_FeedBurn=new createOInputNr(p,"input_feedburn",objektdata.feedrateburn,objektdata.feedratemin,objektdata.feedratemax);
		input_FeedBurn.setclass("inputW60");
		input_FeedBurn.setisInt(true);
		cE(p,"span",'','labeltext2',"mm/s");
		
		cE(p,"br");
		
		cE(p,"span",'','labeltext1',"Feedrate-move:");
		input_FeedMove=new createOInputNr(p,"input_feedmove",objektdata.feedratemove,objektdata.feedratemin,objektdata.feedratemax);
		input_FeedMove.setclass("inputW60");
		input_FeedMove.setisInt(true);
		cE(p,"span",'','labeltext2',"mm/s");
		
		cE(p,"br");
		
		cE(p,"span",'','labeltext1',"Auflösung:");
		input_DPI=new createOInputNr(p,"input_dpi",objektdata.dpi,1,600);
		input_DPI.setclass("inputW60");
		input_DPI.setisInt(true);
		cE(p,"span",'','labeltext2',"dpi");
		
		
		p=cE(ziel,"p","p_outputcanvas","unsichtbar");
		html=createCeckBox(p,"invertieren",objektdata.invertieren);
		html.onchange=function(){
			 objektdata.invertieren=this.checked;
			 setNewSize();
		}
		
		cE(p,"br");
		html=createSlider(p,"minimaler Grauton: ",0,255,1,objektdata.minGrau);
		html.onchange=function(e){
			objektdata.minGrau=this.value;
			setNewSize();
		}
		html.onkeyup=function(e){
			objektdata.minGrau=this.value;
			setNewSize();
		}
		cE(p,"br");
		html=createSlider(p,"Graustufen (fein): ",1,255,1,objektdata.Graustufen);
		html.onchange=function(e){
			objektdata.Graustufen=this.value;
			setNewSize();
		}
		html.onkeyup=function(e){
			objektdata.Graustufen=this.value;
			setNewSize();
		}
		cE(p,"br");
		cE(p,"span",'','labeltext1',"Grauumrechnung nach:");
		createRadioBox(p,"graucalfunc",[
			{value:"GF"	,text:"Helligkeit",checked:true},
			{value:"KR"	,text:"Kanal Rot"},
			{value:"KG"	,text:"Kanal Grün"},
			{value:"KB"	,text:"Kanal Blau"},
			{value:"KRGB"	,text:"(rgb)/3"}
			],
			function(val){objektdata.graufunc=val;setNewSize();}
		);
		
		cE(p,"br");		
		outputcanvas=cE(p,"canvas","outputcanvas");
		
		input_showzielsize=createCeckBox(p,"in Zielgröße anzeigen (Beta)",false);
		input_showzielsize.onchange=function(){
			showZielsize(this.checked);
		}
		
		p=cE(ziel,"p","p_makebutt","unsichtbar");
		makeButt=cE(p,"a","makeButt","button bgreen unsichtbar","konvertiere");
		makeButt.href="#";
		makeButt.onclick=function(){ konvertiere(); return false;}
		
		pauseButt=cE(p,"a","pauseButt","button bred unsichtbar","stopp");
		pauseButt.href="#";
		pauseButt.onclick=function(){ 
			objektdata.stopconvert=true;
			addClass(pauseButt,"unsichtbar"); 
			subClass(makeButt,"unsichtbar");
			return false;}
		
		
		p=cE(ziel,"p","p_outPutDoc","unsichtbar");
		outPutDoc=cE(p,"textarea","outPutDoc","unsichtbar");
	}
	
	var showZielsize=function(an){
		var dpi=75; //objektdata.dpi
		var w=(maF(objektdata.width) *dpi/2.54/10) *10/7.9;//10/7.9 = korrektur
		if(an){
			outputcanvas.style.width= w+"px";
		}
		else{
			outputcanvas.style.width="auto";
		}
	}
	
	var loadImage=function(ifile){
		inputimage.src = URL.createObjectURL(ifile);
	}
 
	var prework=function(){
		var c;
		var dpi=objektdata.dpi;//Punkte pro Zoll = 2,54cm
	
 		objektdata.width	=this.width /dpi*2.54*10;
		objektdata.height	=this.height/dpi*2.54*10;
 
		input_Width.setvalue (maF(objektdata.width));
		input_Height.setvalue(maF(objektdata.height));
		input_DPI.setvalue(objektdata.dpi);
			
		subClass(gE("setdaten"),"unsichtbar");		
		subClass(gE("p_outputcanvas"),"unsichtbar");
		subClass(gE("p_makebutt"),"unsichtbar");
				
		
		preWorkPicture();
		
	}
	
 	var setNewSize=function(e){
		objektdata.width	=input_Width.getvalue();
		objektdata.height	=input_Height.getvalue();
		objektdata.dpi		=input_DPI.getvalue();
		
		preWorkPicture();
		
		subClass(makeButt,"unsichtbar");
		addClass(pauseButt,"unsichtbar");
		
		showZielsize(input_showzielsize.checked);
	}


	var preWorkPicture=function(){		
		var c,cc,bb,hh,imgd,pix,v,r,g,b,alpha,d,x,y,e,gg;
		var dpi=objektdata.dpi;//Punkte pro Zoll = 2,54cm
 
		var inputimage=gE("inputimage");
		//Ausgangsbild auf Zielgröße bringen und in outputcanvas zwischenspeichern
		c=outputcanvas;
		c.width =maR(objektdata.width*dpi/2.54/10);
		c.height=maR(objektdata.height*dpi/2.54/10);
		cc=c.getContext("2d");
	
		bb=inputimage.width;
		hh=inputimage.height;	
		
		cc.drawImage(inputimage,0,0,bb,hh, 0,0,c.width,c.height);
		imgd=cc.getImageData(0,0,c.width,c.height);
		pix=imgd.data;
 
		//outputcanvas in Graustufen wandeln
		for(y=0;y<c.height;y++)
			for(x=0;x<c.width;x++){
				d=(x*4)+(y)*c.width*4;
				
				r=pix[d+0];
				g=pix[d+1];
				b=pix[d+2];
				
				if(objektdata.Graustufen<255){//auf xx Stufen rastern
					gg=255/objektdata.Graustufen;
					r=Math.min ( Math.round(Math.round( r/gg )*gg) ,255 );
					g=Math.min ( Math.round(Math.round( g/gg )*gg) ,255 );
					b=Math.min ( Math.round(Math.round( b/gg )*gg) ,255 );
				}
				
				alpha=pix[d+3];
				
				if(objektdata.invertieren===true){
					r=255-r;
					g=255-g;
					b=255-b;
				}
				
				switch(objektdata.graufunc){
					case "KR":
						v=r;
						break;
					case "KG":
						v=g;
						break;
					case "KB":
						v=b;
						break;
					case "KRGB":
						v=Math.floor((r+g+b)/3);
						break;
						
					default:
						v=Math.round(r*0.299+g*0.587+b*0.114);	// nach helligkeit
					
				}
				
				if(alpha<255){//transparente stellen(gif,png) mit weiß füllen
					alpha=255; 
					pix[d+3]=alpha;
					if(v==0)v=255;
					}
					
				if(v>objektdata.minGrau)v=255;
				
				pix[d+0]=v;//alle Farbkanäle mit grauwert befüllen
				pix[d+1]=v;
				pix[d+2]=v;
				
			}
		 cc.putImageData(imgd, 0, 0);
	};
 
 
	var setPixel=function(canv,x,y,r,g,b,a){
		var cc,id,d;
		cc=canv.getContext("2d");
		id = cc.createImageData(1,1); 
		d  = id.data;                      
		d[0]   = r;
		d[1]   = g;
		d[2]   = b;
		d[3]   = a;
		cc.putImageData( id, x, y );   
	};
	var getPixel=function(canv,x,y){
		var cc,id,d;
		cc=canv.getContext("2d");
		id=cc.getImageData(x,y,1,1);
		pix=id.data;
		return pix;//[r,g,b,a]
	};
 
 
	var zeile=0;
	var konvertiere=function(){
		objektdata.stopconvert=false;
		
		objektdata.dpi=input_DPI.getvalue();
		
		preWorkPicture();
		
		zeile=0;
		
		objektdata.feedratemove=input_FeedMove.getvalue();
		objektdata.feedrateburn=input_FeedBurn.getvalue();

		objektdata.dauer=0;
		
		
		addClass(makeButt,"unsichtbar");
		subClass(pauseButt,"unsichtbar");
		
		outPutDoc.style.display="none";
		
		outPutDoc.innerHTML=" ; start v"+version+"\n";
		outPutDoc.innerHTML+=" ; "+maF(objektdata.width)+" x "+maF(objektdata.height)+"mm² \n";
		
		outPutDoc.innerHTML+="G90 ;absolute Position\n";
		outPutDoc.innerHTML+="M08 ;Flood Coolant On\n";// opt.
		outPutDoc.innerHTML+="G21 ;Set Units to Millimeters\n";// 
				
		if(objektdata.timer!=undefined)window.clearTimeout(objektdata.timer);
		objektdata.timer=window.setTimeout(konvertiereF,10);//Zeilen per Timer durchgehen um Script-Blockierung zu verhindern
	};
 
	var calcDauerData={x:0,y:0};
	var calcDauer=function(x,y,speed){
		if(objektdata.dauer==0){
			 calcDauerData={x:0,y:0};
		}
		//Weg von der letzten Position zur neuen:
		var weg=Math.sqrt( Math.pow(y-calcDauerData.y,2)+Math.pow(x-calcDauerData.x,2));
		objektdata.dauer+=1/speed*weg;		
		calcDauerData={x:x,y:y};//letzte Position merken
	}
 
 
	var konvertiereF=function(){
		var c,cc,imgd,pix,x,y,d,r,g,b,frb,
			szeile="",
			valuecount;
		c=outputcanvas;
		cc=c.getContext("2d");
		imgd=cc.getImageData(0,0,c.width,c.height);
		pix=imgd.data;
 
		//mm pro Pixel
		var stepX=objektdata.width/c.width ;	//mm pro Pixel
		var stepY=objektdata.height/c.height ;	
		if(zeile==0){
			outPutDoc.innerHTML+="; mm/Pixel "+maF(stepX)+" "+maF(stepY)+"\n";
			outPutDoc.innerHTML+="; "+objektdata.dpi+" dpi \n";
		}
 
		var lposX=0;
		var lposY=-zeile*stepY;
		y=zeile;//Y per Timer sonst Script zu sehr ausgelastet
		
		
		if(objektdata.yspezialmove && zeile!=0){
			//DOTO:Test
			szeile+="G1 X"+maF(lposX)+" S0 F"+objektdata.feedratemove+"\n";
			calcDauer(maF(lposX),maF(lposY),objektdata.feedratemove);
			szeile+="G1 Y"+maF(lposY-2)+"\n";
			calcDauer(maF(lposX),maF(lposY-2),objektdata.feedratemove);
			//y weiter verfahren um Ungenauigkeit im Gerät zu umgehen
		}
		
		szeile+="G1 X"+maF(lposX)+" Y"+maF(lposY)+" S0 F"+objektdata.feedratemove+"\n";	//erste Position anfahren  //TODO: testen mit S0 evtl. m3/m5 nicht nötig
		calcDauer(maF(lposX),maF(lposY),objektdata.feedratemove);
		szeile+="M3\n";										//Spindle On, Clockwise
		
		valuecount=0;
		x=0;
		d=(x*4)+(y)*c.width*4;
		var getkanal=0;//rgba 0=r
		var lastpixel=pix[d+getkanal];
		var minblack=255;
		var lastbefehl="";
		lposX+=stepX;
		for(x=1;x<c.width;x++){
			d=(x*4)+(y)*c.width*4; //pos=rgba * y*width*rgba
			r=pix[d+getkanal];//nur einen kanal auswerten (=graustufen 0...255)
			
			//lauflängen...
			if(r!=lastpixel || x==(c.width-1)){
				
				if(x==(c.width-1))lposX+=stepX;			
				
				
				//G1 Xnnn Ynnn Znnn Ennn Fnnn Snnn 
				lastbefehl="G1 X"+maF(lposX);//fahre bis  	//G0 Rapid Move: quickly and efficiently as possible  
				
				frb=objektdata.feedrateburn;
				
											//G1 Controlled Move: as precise as possible
				if(lastpixel==255)
					frb=objektdata.feedratemove;
				
				lastbefehl+=" F"+frb;
				
				lastbefehl+=" S"+Math.floor(1000-(1000/255*lastpixel))+"\n";	//Set Spindle Speed/Intensität
			
				if( x==(c.width-1) ){//leerfahrten am Ende entfernen
					if(lastpixel<255){
						szeile+=lastbefehl;
						calcDauer(maF(lposX),maF(lposY),frb);
						}
				}
				else{
					szeile+=lastbefehl;
					calcDauer(maF(lposX),maF(lposY),frb);
				}
				
				valuecount++;
				if(minblack>lastpixel){
					minblack=lastpixel;
					}
				
				lastpixel=r;				
			}	
			
			lposX+=stepX;				
		}
		szeile+="M5\n"; //Spindle Off
		
		//wenn Zeile =0 dann gleich zur nächsten
 		if(valuecount>1 && minblack<255){//keine Leerzeilen erzeugen
			outPutDoc.innerHTML+=szeile;
			
			setPixel(c,0,zeile, 255,0,0,255);
			setPixel(c,1,zeile, 255,0,0,255);
			setPixel(c,(c.width-1),zeile, 255,0,0,255);
			setPixel(c,(c.width-2),zeile, 255,0,0,255);			
			
		}else{//Leerzeile
			setPixel(c,0,zeile, 0,255,0,255);
			setPixel(c,1,zeile, 0,255,0,255);
			setPixel(c,(c.width-1),zeile, 0,255,0,255);
			setPixel(c,(c.width-2),zeile, 0,255,0,255);			
		}
		 
 
		zeile++;
		if(zeile<c.height){
				if(objektdata.stopconvert){//Stopp gedrückt?
					outPutDoc.style.display="inline-block";	
					subClass(gE("p_outPutDoc"),"unsichtbar");
				}
				else
					window.setTimeout(konvertiereF,10);
			}
			else{
				//ende
				outPutDoc.innerHTML+="S0\n";//
				outPutDoc.innerHTML+="G0 X0 Y0\n";//back to start
				outPutDoc.innerHTML+="M9 ; Coolant Off\n";//
				outPutDoc.innerHTML+=" ; Dauer min. "+Math.round(objektdata.dauer*objektdata.timekorr+1)+"min \n";//
				outPutDoc.innerHTML+=" ; end \n";//
				outPutDoc.style.display="inline-block";	
				subClass(gE("p_outPutDoc"),"unsichtbar");
				
				addClass(pauseButt,"unsichtbar");
				subClass(makeButt,"unsichtbar");						
			}
	};
  
	var handleFile=function(){
		addClass(pauseButt,"unsichtbar");
		objektdata.stopconvert=false;
 
		var reader = new FileReader();
		reader.onload = function(theFile) {
				var data=this.result;
				var ifile=inputFile.files[0];
				var filename=ifile.name.toLowerCase();
 
				if(filename.indexOf(".jpg")>-1 
					|| filename.indexOf(".jpeg")>-1 
					|| filename.indexOf(".png")>-1 
					|| filename.indexOf(".bmp")>-1 
					|| filename.indexOf(".gif")>-1 
					){
 
					loadImage(ifile);
					subClass(makeButt,"unsichtbar");
				}; 
				outPutDoc.innerHTML="";
			};
		reader.readAsBinaryString(inputFile.files[0]);		
	}; 
 
	ziel=gE(zielID);
	ini();
};
 

 
window.onload=function(){			
	var ptl=new akPicToLaser("PicToLaser");
 
};
