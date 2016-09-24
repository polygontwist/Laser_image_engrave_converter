/*
	Berechnet aus JPEG, GIF, PNG Bilden gcode zum Laser-gravieren
	Auflösung: 75 dpi -> Zeilen sind erkennbar 

	optimal Speed F1000 und 8% Laserstärke
	
	Testen ob weniger Speed und Laserstärke geht (F500 & 4% ?)
	150dpi testen
*/


var akPicToLaser=function(zielID){
	var version="1.1 2016-09-25";
	
	var ziel;	
 
	//http://www.shapeoko.com/wiki/index.php/Previewing_G-Code
	//reprap.org/wiki/G-code
	//http://linuxcnc.org/docs/html/gcode.html
 
	//helper
	var cE=function(ziel,e,id,cn){
			var newNode=document.createElement(e);
			if(id!=undefined && id!="")newNode.id=id;
			if(cn!=undefined && cn!="")newNode.className=cn;
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
	var maF=function(r){return Math.floor(r*1000)/1000;}
	var maR=function(r){return Math.round(r);}
 
	//--var--
	var inputFile;
	var outPutDoc;
	var inputimage;
	var outputcanvas;
	var makeButt;
	var pauseButt;
 
	var input_Width=undefined;
	var input_Height;
 
	var objektdata={
		width:1,	//mm
		height:1,
		unit:"mm",
		Dlaser:0.125,//Laserdurchmesser in mm  --> minimaler Zeilenabstand --> 203,2dpi
		dpi:75		 //Punkte pro Zoll = Punkte pro 2,54cm
	}
 
	var pause=false;
	//
	
	var ini=function(){
		var html,p;
		p=cE(ziel,"p");
		p.innerHTML="Bitte Datei wählen: ";
		inputFile=cE(p,"input","inputFile");
		inputFile.type="file";
		inputFile.accept="image/*;capture=camera";
		inputFile.size="50";//MB
		inputFile.onchange=handleFile;
		
		inputimage=cE(ziel,"img","inputimage");
		inputimage.onload=prework;
		addClass(inputimage,"unsichtbar");
		
		p=cE(ziel,"p","setdaten");
		addClass(p,"unsichtbar");
		p.innerHTML="Lasern in einer Größe von ";
		
		
		input_Width=cE(p,"input","input_Width");
		input_Width.name="input_Width";
		input_Width.type="number";
		input_Width.step="any";
		input_Width.min=1;
		input_Width.max=500;
		input_Width.placeholder ="in mm";
		input_Width.setAttribute("value",objektdata.width);
		
		p.innerHTML+=" * ";
		
		input_Height=cE(p,"input","input_Height");
		input_Height.name="input_Height";
		input_Height.step="any";
		input_Height.type="number";
		input_Height.placeholder ="in "+objektdata.unit;
		input_Height.min=1;
		input_Height.max=500;
		input_Height.setAttribute("value",objektdata.height);
									
		p.innerHTML+=" (Breite * Höhe in "+objektdata.unit+") ";
		
		html=cE(p,"a",undefined,"button");
		html.href="#";
		html.onclick=setNewSize;
		html.innerHTML="set new size";
		
		
		p=cE(ziel,"p");
		outputcanvas=cE(p,"canvas","outputcanvas");
		
		p=cE(ziel,"p");
		makeButt=cE(p,"a","makeButt","button");
		makeButt.href="#";
		makeButt.onclick=function(){ konvertiere(); return false;}
		makeButt.innerHTML="konvertiere";
		addClass(makeButt,"unsichtbar");
 
		p=cE(ziel,"p");
		pauseButt=cE(p,"a","pauseButt","button bred");
		pauseButt.href="#";
		pauseButt.onclick=function(){ pause=true; return false;}
		pauseButt.innerHTML="stopp";
		addClass(pauseButt,"unsichtbar");
		
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
 
		e=gE("input_Width");
		e.value=maF(objektdata.width);
		
		e=gE("input_Height");
		e.value=maF(objektdata.height);

		c=gE("setdaten");
		subClass(c,"unsichtbar");
		
		preWorkPicture();
	}
	
 	var setNewSize=function(e){
		var e;
		e=gE("input_Width");
 		objektdata.width	=e.value;
		e=gE("input_Height");
		objektdata.height	=e.value;

		preWorkPicture();
		
		subClass(makeButt,"unsichtbar");
		addClass(pauseButt,"unsichtbar");
		
	}
	

	var preWorkPicture=function(){		
		var c,cc,bb,hh,imgd,pix,v,r,g,b,d,x,y,e;
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
 
				v=Math.round(r*0.299+g*0.587+b*0.114);	// nach helligkeit
				v=Math.floor((r+g+b)/3);				// (r+g+b)/2
				pix[d+0]=v;
				pix[d+1]=v;
				pix[d+2]=v;
				
			}
		 cc.putImageData(imgd, 0, 0);
 		
	}
 
 
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
	}
	var getPixel=function(canv,x,y){
		var cc,id,d;
		cc=canv.getContext("2d");
		id=cc.getImageData(x,y,1,1);
		pix=id.data;
		return pix;//[r,g,b,a]
	}
 
 
	var zeile=0;
	var konvertiere=function(){
		zeile=0;
		
		addClass(makeButt,"unsichtbar");
		subClass(pauseButt,"unsichtbar");
		outPutDoc.innerHTML=";start v"+version+"\n";
		outPutDoc.innerHTML+=";"+maF(objektdata.width)+" x "+maF(objektdata.height)+"mm² \n";
		
		outPutDoc.innerHTML+="G90 ;absolute Positioning\n";
		outPutDoc.innerHTML+="M08 ;Flood Coolant On\n";// opt.
		outPutDoc.innerHTML+="G21 ;Set Units to Millimeters\n";// 
		outPutDoc.innerHTML+="F1000 ;speed\n";
		outPutDoc.style.display="none"
		window.setTimeout(konvertiereF,10);//Zeilen per Timer durchgehen um Script-Blockierung zu verhindern
	}
 
 
	var konvertiereF=function(){
		var c,cc,imgd,pix,x,y,d,r,g,b;
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
		var s="";		
		y=zeile;//Y per Timer sonst Script zu sehr ausgelastet
		s+="G1 X"+maF(lposX)+" Y"+maF(lposY)+" S0\n";	//erste Position anfahren  //TODO: testen mit S0 evtl. m3/m5 nicht nötig
		s+="M3\n";										//Spindle On, Clockwise
 
		x=0;
		d=(x*4)+(y)*c.width*4;
		var lastpixel=pix[d+1];
		for(x=1;x<c.width;x++){
			d=(x*4)+(y)*c.width*4;
			r=pix[d+1];//nur Rotkanal auswerten (=graustufen)
			
			//lauflängen...
			if(r!=lastpixel || x==(c.width-1)){
				//if(x==(c.width-1) && lastpixel!=255)
				//TODO: leerfahrten am Ende evtl. entfernen
				//burnIN am Anfang/Ende verhindern, wie? -> wenigerPower + langsammer?
				s+="G1 X"+maF(lposX)+" ";//fahre bis  				//G0 Rapid Move: quickly and efficiently as possible  
																	//G1 Controlled Move: as precise as possible
				s+="S"+Math.floor(1000-(1000/255*lastpixel))+"\n";	//Set Spindle Speed/Intensität
				
				//G1 Xnnn Ynnn Znnn Ennn Fnnn Snnn 
				
				lastpixel=r;
			}	
			
			//if(r>128)s+="0";else s+="1"
			lposX+=stepX;				
		}
		//s+="\n";
		s+="M5\n"; //Spindle Off
 
		outPutDoc.innerHTML+=s;
 
		setPixel(c,0,zeile, 255,0,0,255);
		setPixel(c,1,zeile, 255,0,0,255);
		setPixel(c,(c.width-1),zeile, 255,0,0,255);
		setPixel(c,(c.width-2),zeile, 255,0,0,255);
 
		zeile++;
		if(zeile<c.height){
				if(pause){//Stopp
					//window.setTimeout(konvertiereF,1000);//1sec
					outPutDoc.style.display="inline-block";	
				}
				else
					window.setTimeout(konvertiereF,10);
			}
			else{
				//ende
				outPutDoc.innerHTML+="S0\n";//
				outPutDoc.innerHTML+="G01 X0 Y0\n";//back to start
				outPutDoc.innerHTML+="M9 ;Coolant Off\n";//
				outPutDoc.innerHTML+=";end \n";//
				outPutDoc.style.display="inline-block";	
				addClass(pauseButt,"unsichtbar");				
			}
	}
 
 
	var handleFile=function(){
		addClass(pauseButt,"unsichtbar");
		pause=false;
 
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
				}
 
				outPutDoc.innerHTML="";
 
				
 
			};
		reader.readAsBinaryString(inputFile.files[0]);		
	}
 
 
	ziel=gE(zielID);
	ini();
	
	
}
 

 
window.onload=function(){			
	var ptl=new akPicToLaser("PicToLaser");
 
};
