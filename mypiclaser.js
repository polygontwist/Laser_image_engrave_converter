/*
	Berechnet aus JPEG, GIF, PNG Bilden gcode zum Laser-gravieren
	Auflösung: 75 dpi -> Zeilen sind erkennbar 

	optimal Speed F1000 und 8% Laserstärke
	
	Testen ob weniger Speed und Laserstärke geht (F500 & 4% ?)
	150dpi testen
*/


var akPicToLaser=function(zielID){
	var version="1.2 2016-09-25";
	
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
	var maF=function(r){return Math.floor(r*1000)/1000;} //runden mit 3 nachkommastellen
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
 
	var objektdata={
		feedrateburn:800,		//max:2400  800@8% 1000@8%
		feedratemove:2400,
		minGrau:128,		//0..255  alles unter minGrau wird zu 0 (nicht lasern)
		width:1,	//mm
		height:1,
		unit:"mm",
		Dlaser:0.125,//Laserdurchmesser in mm  --> minimaler Zeilenabstand -->max 203,2dpi
		dpi:75,		 //Punkte pro Zoll = Punkte pro 2,54cm
	
		timer:undefined,
		stopconvert:false
	}
 
	var oInputNr=function(ziel,id,inivalue,min,max){
		var htmlNode;
		var value=inivalue;
		
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
			}
		}
		
		this.getvalue=function(){
			return value;
		}
		this.setvalue=function(v){
			value=v;
			htmlNode.value=v;
			htmlNode.setAttribute("value",value);
		}
		
		create();
	}
	
	var ini=function(){
		var html,p;
		
		p=cE(ziel,"p");
		html=cE(p,"span",'','',"Bitte Datei wählen: ");
				
		inputFile=cE(p,"input","inputFile");
		inputFile.type="file";
		inputFile.accept="image/*;capture=camera";
		inputFile.size="50";//MB
		inputFile.onchange=handleFile;
		
		inputimage=cE(ziel,"img","inputimage","unsichtbar");
		inputimage.onload=prework;
		
		p=cE(ziel,"p","setdaten","unsichtbar");
		html=cE(p,"span",'','',"Lasern in einer Größe von ");
		
		input_Width=new oInputNr(p,"input_Width",objektdata.width,1,500);
				
		html=cE(p,"span",'',''," * ");
		
		input_Height=new oInputNr(p,"input_Height",objektdata.height,1,500);
											
		html=cE(p,"span",'',''," (Breite * Höhe in "+objektdata.unit+") ")
		
		html=cE(p,"a",undefined,"button","set new size");
		html.href="#";
		html.onclick=setNewSize;
		
		
		p=cE(ziel,"p");
		outputcanvas=cE(p,"canvas","outputcanvas");
		
		p=cE(ziel,"p");
		makeButt=cE(p,"a","makeButt","button unsichtbar","konvertiere");
		makeButt.href="#";
		makeButt.onclick=function(){ konvertiere(); return false;}
		
		p=cE(ziel,"p");
		pauseButt=cE(p,"a","pauseButt","button bred unsichtbar","stopp");
		pauseButt.href="#";
		pauseButt.onclick=function(){ objektdata.stopconvert=true; return false;}
		
		outPutDoc=cE(ziel,"textarea","outPutDoc");
 		addClass(outPutDoc,"unsichtbar");
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
		
		c=gE("setdaten");
		subClass(c,"unsichtbar");
		
		preWorkPicture();
	}
	
 	var setNewSize=function(e){
		objektdata.width	=input_Width.getvalue();
		objektdata.height	=input_Height.getvalue();

		preWorkPicture();
		
		subClass(makeButt,"unsichtbar");
		addClass(pauseButt,"unsichtbar");
		
	}
	

	var preWorkPicture=function(){		
		var c,cc,bb,hh,imgd,pix,v,r,g,b,alpha,d,x,y,e;
		var dpi=objektdata.dpi;//Punkte pro Zoll = 2,54cm
 
		var inputimage=gE("inputimage");
 
		c=outputcanvas;
		c.width =maR(objektdata.width*dpi/2.54/10);
		c.height=maR(objektdata.height*dpi/2.54/10);
		cc=c.getContext("2d");
	
		bb=inputimage.width;
		hh=inputimage.height;	
 
		cc.drawImage(inputimage,0,0,bb,hh, 0,0,c.width,c.height);
		imgd=cc.getImageData(0,0,c.width,c.height);
		pix=imgd.data;
 
		//in graustufen
		for(y=0;y<c.height;y++)
			for(x=0;x<c.width;x++){
				d=(x*4)+(y)*c.width*4;
				
				r=Math.round(16/255*pix[d+0])*16;
				g=Math.round(16/255*pix[d+1])*16;
				b=Math.round(16/255*pix[d+2])*16;
				alpha=pix[d+3];
				 
				v=Math.round(r*0.299+g*0.587+b*0.114);	// nach helligkeit
				v=Math.floor((r+g+b)/3);				// (r+g+b)/2
				
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
		zeile=0;
		
		addClass(makeButt,"unsichtbar");
		subClass(pauseButt,"unsichtbar");
		
		outPutDoc.style.display="none";
		
		outPutDoc.innerHTML=" ; start v"+version+"\n";
		outPutDoc.innerHTML+=" ; "+maF(objektdata.width)+" x "+maF(objektdata.height)+"mm² \n";
		
		outPutDoc.innerHTML+="G90 ;absolute Positioning\n";
		outPutDoc.innerHTML+="M08 ;Flood Coolant On\n";// opt.
		outPutDoc.innerHTML+="G21 ;Set Units to Millimeters\n";// 
				
		if(objektdata.timer!=undefined)window.clearTimeout(objektdata.timer);
		objektdata.timer=window.setTimeout(konvertiereF,10);//Zeilen per Timer durchgehen um Script-Blockierung zu verhindern
	};
 
 
	var konvertiereF=function(){
		var c,cc,imgd,pix,x,y,d,r,g,b,szeile,
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
 
		var lposX=stepX;
		var lposY=-zeile*stepY;
		y=zeile;//Y per Timer sonst Script zu sehr ausgelastet
		
		szeile="G1 X"+maF(lposX)+" Y"+maF(lposY)+" S0 F"+objektdata.feedratemove+"\n";	//erste Position anfahren  //TODO: testen mit S0 evtl. m3/m5 nicht nötig
		szeile+="M3\n";										//Spindle On, Clockwise
		
		valuecount=0;
		x=0;
		d=(x*4)+(y)*c.width*4;
		var getkanal=0;//rgba 0=r
		var lastpixel=pix[d+getkanal];
		var minblack=255;
		var lastbefehl="";
		
		for(x=1;x<c.width;x++){
			d=(x*4)+(y)*c.width*4; //pos=rgba * y*width*rgba
			r=pix[d+getkanal];//nur einen kanal auswerten (=graustufen 0...255)
			
			//lauflängen...
			if(r!=lastpixel || x==(c.width-1)){
				//if(x==(c.width-1) && lastpixel!=255)
				
				//burnIN am Anfang/Ende verhindern, wie? -> wenigerPower + langsammer?
				//-->liegt an grbl -->CNC-Fräse langsam anfahren/abbremsen
				
				//G1 Xnnn Ynnn Znnn Ennn Fnnn Snnn 
				lastbefehl="G1 X"+maF(lposX);//fahre bis  	//G0 Rapid Move: quickly and efficiently as possible  
															//G1 Controlled Move: as precise as possible
				if(lastpixel==255)
					lastbefehl+=" F"+objektdata.feedratemove;
				else
					lastbefehl+=" F"+objektdata.feedrateburn;
				
				lastbefehl+=" S"+Math.floor(1000-(1000/255*lastpixel))+"\n";	//Set Spindle Speed/Intensität
			
				if( x==(c.width-1) ){//leerfahrten am Ende entfernen
					if(lastpixel<255)
						szeile+=lastbefehl;
				}
				else{
					szeile+=lastbefehl;
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
				if(objektdata.stopconvert){//Stopp
					outPutDoc.style.display="inline-block";	
				}
				else
					window.setTimeout(konvertiereF,10);
			}
			else{
				//ende
				outPutDoc.innerHTML+="S0\n";//
				outPutDoc.innerHTML+="G0 X0 Y0\n";//back to start
				outPutDoc.innerHTML+="M9 ; Coolant Off\n";//
				outPutDoc.innerHTML+=" ; end \n";//
				outPutDoc.style.display="inline-block";	
				addClass(pauseButt,"unsichtbar");				
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
