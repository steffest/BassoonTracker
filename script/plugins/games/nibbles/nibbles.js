var Nibbles = function(){
	var me = {
		name: "nibbles"
	};
	
	var DIRECTION={
		LEFT: 37,
		UP: 38,
		RIGHT: 39,
		DOWN: 40
	}

	var GAMSESTATE={
		IDLE: 1,
		PLAYING: 2,
		PAUSED: 3,
		WON: 4,
		LOST: 5,
		GAMEOVER: 6,
	}
	
	var renderTarget;
	var beginStepTime = 0;
	var lastStepTime = 0;
	var frameTime = 100;
	var registeredRenderEvent;
	var host;

	var highScoreTable = [
		{name: "Vogue", score: 2000000, level: 26},
		{name: "Mr. H", score: 2000000, level: 27},
		{name: "Steffest", score: 1000000, level: 28},
		{name: "LizardKing", score: 100000, level: 12},
		{name: "Jogeir", score: 90000, level: 11},
		{name: "Dr. Awesome", score: 80000, level: 8},
		{name: "4mat", score: 70000, level: 7},
		{name: "Romeo Knight", score: 60000, level: 5},
		{name: "HoffMan", score: 5000, level: 2},
		{name: "Aceman", score: 4000, level: 1}
	];
	var storedHighScoreTable = localStorage.getItem("nibblesHighscore");
	if (storedHighScoreTable){
		try {
			storedHighScoreTable = JSON.parse(storedHighScoreTable);
			highScoreTable = storedHighScoreTable;
		}catch (e){}
	}

	
	var Game = function(){
		var mapHeight = 10;
		var gridsize = 10;
		var mapWidth = 10;
		
		var snakeX;
		var snakeY;
		
		var direction,nextDirection;
		var isRunning;

		var map=[];
		var changeMap=[];

		var doWrap = false;
		var showGrid = true;
		var gridDrawn = false;
		var fullrefresh;

		var game = host.UI.element(0,0,10,10);
		game.zIndex = 1;
		var ctx = game.ctx;
		var currentNumber;
		var state=GAMSESTATE.IDLE;

		var levelSprites = [];
		var level=1;
		var lives=5;
		var colors=[];
		var colorMap={};
		var score;
		var highScore;
		
		var gameControls;

		game.reset = function(){
			lives = 5;
			score = 0;
			level = 1;
			game.start();
		}

		game.start = function(){
			console.log("start game");
			game.hideInfo();
			direction = DIRECTION.LEFT;
			nextDirection = undefined;
			currentNumber=1;
			map=[];
			changeMap = [];
			gridDrawn = false;
			fullrefresh = true;
			state = GAMSESTATE.PLAYING;

			game.resize();
			game.clearCanvas();
			game.setLevel(level);
			setCell(snakeX,snakeY,1000);
			placeNumber();
			gameControls.setScore(score);
			score=score||0;
			gameControls.setLives(lives);

			game.refresh();
			if (host.Layout.prefered === "col3"){
				gameControls.hideConfig();
			}
			isRunning = true;
		}
		
		game.togglePause = function(){
			if (state === GAMSESTATE.PLAYING){
				state=GAMSESTATE.PAUSED;
				isRunning = false;
				game.showInfo("Game Paused","Resume");
			}else{
				gridDrawn = false;
				game.clearCanvas();
				fullrefresh = true;
				state=GAMSESTATE.PLAYING;
				game.hideInfo();
				isRunning = true;
			}
			game.refresh();
		}

		game.won = function(){
			state=GAMSESTATE.WON;
			isRunning = false;
			level++;
			lives++;
			level = Math.min(level,30);
			game.showInfo("You made it!","Start Level " + level);
			gameControls.setLives(lives);
			game.refresh();
		};

		game.lost = function(){
			state=GAMSESTATE.LOST;
			isRunning = false;
			lives--;
			gameControls.setLives(lives);
			if (lives<=0){
				state=GAMSESTATE.GAMEOVER;
				game.showInfo("Game Over","REMATCH");
				game.checkHighScore(score);
			}else{
				game.showInfo("Boom! Player 1 died","Try Again");
			}
			game.refresh();
		};

		game.checkHighScore = function(score){
			var index = highScoreTable.findIndex(function(item){return item.score<score});
			if (index>0){
				host.UI.showDialog("GAME OVER//But don't be sad/because you made the enternal/HIGHSCORE HALL OF FAME//Enter your name",function(value){
					setTimeout(function(){
						value = value || "John Doe";
						highScoreTable.splice(index,0,{name: value, score: score, level: level});
						highScoreTable.pop();
						host.Input.setFocusElement(me);
						localStorage.setItem("nibblesHighscore",JSON.stringify(highScoreTable));
						game.showHighScore();
					},0)
				},function(){
					setTimeout(function(){
						host.Input.setFocusElement(me);
					},0)
				},true);
			}
		}
		
		game.setSpeed = function(delay){
			frameTime = delay;
		}
		game.setGrid = function(v){
			showGrid=v;
			gridDrawn = false;
			fullrefresh = true;
			game.refresh();
		}
		game.setWrap = function(v){
			doWrap=v;
		}
		
		game.update = function(){
			if (!isRunning) return;
			
			if (nextDirection) direction=nextDirection;
			nextDirection = undefined;
			
			switch (direction){
				case DIRECTION.LEFT:
					snakeX--;
					break;
				case 38:
					snakeY--;
					break;
				case 39:
					snakeX++;
					break;
				case 40:
					snakeY++;
					break;
			}

			var canMove = true;
			if (snakeX<0 || snakeY<0 || snakeX>=mapWidth || snakeY>=mapHeight){
				// off grid
				if (doWrap){
					if (snakeX<0) snakeX=mapWidth-1;
					if (snakeX>=mapWidth) snakeX=0;
					if (snakeY<0) snakeY=mapHeight-1;
					if (snakeY>=mapHeight) snakeY=0;
				}else{
					canMove = false;
				}
			}else{
				var v = cell(snakeX,snakeY);
				if (v) {
					if (v<10){
						currentNumber++;
						if (currentNumber>9){
							game.won();
						}else{
							score+= (1000 + (200-frameTime)*currentNumber*2);
							gameControls.setScore(score);
							placeNumber();
						}
					}else{
						// bump
						canMove = false;
					}
				}
			}
			if (canMove){
				setCell(snakeX,snakeY,1000);

				// calculate new states
				for (var x=0; x<mapWidth; x++){
					for (var y=0; y<mapHeight; y++){
						v = cell(x,y);
						if (v>=1000){
							// snake
							v++;
							if (v>1000 + snakeLength() + 1) v=0;
							setCell(x,y,v);
						}
					}
				}
				
				if (score) score--;
				gameControls.setScore(score);
			}else{
				game.lost();
			}
			
			game.refresh();
		}

		game.move = function(_direction){
			if (_direction !== oppositeDirection(direction)) nextDirection= _direction;
		}
		
		game.render = function(){
			if (!game.isVisible()) return;
			if (game.needsRendering){
				if (fullrefresh){
					game.clearCanvas();
					gridDrawn = false;
				}
				if (!gridDrawn){
					if (showGrid){
						drawGrid();
					}else{
						drawBorder();
					}
				}

				var v;

				for (var x=0; x<mapWidth; x++){
					for (var y=0; y<mapHeight; y++){
						if (fullrefresh || isChanged(x,y)){
							v = cell(x,y);
							if (v){
								var color;
								if (v>=1000){
									color = "white";
									if (v>1001){
										color = "rgba(255,255,255,0.6)";
									}
									drawCell(x,y,color);
								}else{
									if (v<10){
										drawCell(x,y,v);
									}else{
										color = colors[v-10] || "#FF0000";
										drawCell(x,y,"rgb(" + color + ")");
									}
								}
							}else{
								color = "transparent";
								drawCell(x,y,color);
							}
						}
					}
				}
				
				if (state !== GAMSESTATE.PLAYING){
					ctx.fillStyle = "rgba(0,0,0,0.3)";
					ctx.fillRect(0,0,game.width,game.height);
				}
				
				game.needsRendering = false;
				fullrefresh=false;
			}

			game.parentCtx.drawImage(game.canvas,game.left,game.top,game.width,game.height);
		}

		game.resize = function(){
			gridsize = 10;
			mapHeight = Math.floor((renderTarget.height-4)/gridsize);

			var w=host.Layout.col3W;
			var x = host.Layout.col2X;
			if (host.Layout.prefered === "col3"){
				w=host.Layout.col32W;
				x = host.Layout.col31X;
			}
			mapWidth = Math.floor(w/gridsize);
			game.setSize(mapWidth*gridsize+1,mapHeight*gridsize+1);
			var marginW = ((w-game.width)>>1) + 1;
			var marginH = (renderTarget.height-game.height)>>1;
			game.setPosition(x + marginW,marginH);

			if (highScore){
				highScore.setSize(w,renderTarget.height);
				highScore.setPosition(x,0);
			}


			
		}
		
		game.onClick = function(){
			host.Input.setFocusElement(me);
			if (highScore && highScore.isVisible())return;
			switch (state){
				case GAMSESTATE.LOST:
				case GAMSESTATE.WON:
				case GAMSESTATE.IDLE:
					game.start();
					break;
				case GAMSESTATE.PAUSED:
				case GAMSESTATE.PLAYING:
					game.togglePause();
					break;
				case GAMSESTATE.GAMEOVER:
					game.reset();
					break;
			}
		}

		game.setLevel=function(){
			var levelImage = getLevelSprite();
			var w = levelImage.width;
			var h = levelImage.height;
			var _ctx = levelImage.getContext("2d");
			var levelData = _ctx.getImageData(0, 0, w,  h).data;

			var marginLeft = (mapWidth-w)>>1;
			var marginTop = (mapHeight-h)>>1;
			if (marginLeft<0 || marginTop<0) console.warn("Warning: level doesn't fit on playing area");

			snakeX=snakeY=0;
			for (var x = 0; x<w; x++){
				for (var y = 0; y<h; y++){
					var index = ((y*w)+x)*4;
					var r=levelData[index];
					var g=levelData[index+1];
					var b=levelData[index+2];

					if (r>0 || g>0 || b>0){
						if (r===255 && g===0 && b===255){
							// startPoint
							snakeX = marginLeft+x;
							snakeY = marginTop+y;
						}else{
							var color = r+","+g+","+b;
							index = colorMap[color];
							if (!index){
								index = colors.length + 10;
								colorMap[color]=index;
								colors.push(color);
							}
							setCell(marginLeft+x,marginTop+y,index);
						}
					}

				}
			}
			if (snakeX===0 && snakeY===0){
				console.warn("Warning: no starting point of Nibbles level!");
				snakeX = 30;
				snakeY = 2;
			}
		}

		game.toggleHighScore = function(){
			if (highScore && highScore.isVisible()){
				game.hideHighScore();
			}else{
				game.showHighScore();
			}
		}

		game.showHighScore = function(){
			if (state === GAMSESTATE.PLAYING){
				game.togglePause();
			}
			game.hide();
			if (!highScore){
				highScore = host.UI.panel();
				highScore.render = function(){
					if (!highScore.isVisible()) return;
					if (highScore.needsRendering){
						highScore.clearCanvas();
						var ctx = highScore.ctx;
						//ctx.fillStyle = "#355505";
						//ctx.fillRect(0,0,highScore.width,highScore.height);
						//ctx.drawImage(Y.getImage("panel_dark"),0,0,highScore.width+10,highScore.height+10);
						var h = highScore.height;
						var w = highScore.width;
						var marginLeft = 10;
						var lineH = Math.floor(h/6);
						var colW = Math.floor(highScore.width/2);
						var displayCount = 10;

						var titleFont = fontBig;
						if (w < 380){
							titleFont = fontMed;
							marginLeft = 4;
							displayCount = 5;
							colW=highScore.width;
						}
						if (w < 300){
							titleFont = fontSuperCondensed;
						}
						

						var line = host.Y.getImage("line_hor");
						ctx.drawImage(host.Y.getImage("line_ver"),colW,lineH,3,h);

						var marginTop = 6;
						titleFont.write(highScore.ctx,"Nibbles Highscore List of Fame",marginLeft,marginTop+3,1);

						var font = fontMed;
						if (colW <270){
							font = fontSmall
							marginLeft = 4;
						}
						if (colW <200){
							font = fontSuperCondensed;
							marginLeft = 4;
						}
						highScoreTable.forEach(function(item,i){
							if (i<displayCount){
								var y = i*lineH + lineH;
								var x = marginLeft;
								if (i>4){
									x=colW + marginLeft;
									y =(i-5)*lineH + lineH;
								}else{
									highScore.ctx.drawImage(line,0,y,highScore.width,2);
								}
								y+=marginTop;

								font.write(highScore.ctx,item.name,x+10,y+5,0,"green");

								var _score = ""+item.score;
								var scoreLen = (font.charWidth+1)*_score.length;
								font.write(highScore.ctx,_score,x + colW - 80 - scoreLen,y+5,1,"orange");


								highScore.ctx.fillStyle = "rgba(0,0,0,0.7)";
								highScore.ctx.fillRect(x + colW - 64,y-3,48,23);
								highScore.ctx.drawImage(getLevelSprite(item.level),x + colW - 60,y+1);
							}

						})


					}
					highScore.needsRendering = false;
					highScore.parentCtx.drawImage(highScore.canvas,highScore.left,highScore.top,highScore.width,highScore.height);


				}
				renderTarget.addChild(highScore);
				renderTarget.onResize();
			}
			gameControls.hideInfo();
			highScore.show();
			renderTarget.refresh();
		}

		game.hideHighScore = function(){
			if (highScore) highScore.hide();
			game.show();
			gameControls.showInfo();
			renderTarget.refresh();
		}
		
		game.setControls = function(_controls){
			gameControls = _controls;
		}

		function getLevelSprite(_level){
			_level = _level||level;
			if (levelSprites[_level]) return levelSprites[_level];

			var levelWidth = 40;
			var levelHeight = 15;
			var row = Math.floor((_level-1)/5);
			var col = (_level-1) - row*5;
			var x = 1 + col*(levelWidth+1);
			var y = 1 + row*(levelHeight+1);
			var _canvas = document.createElement("canvas");
			_canvas.width = levelWidth;
			_canvas.height = levelHeight;
			var _ctx = _canvas.getContext("2d");
			var base = host.Y.getImage("Nibbles.levels");
			_ctx.drawImage(base,x,y,levelWidth,levelHeight,0,0,levelWidth,levelHeight);
			levelSprites[_level] = _canvas;
			return _canvas;
		}
		
		function cell(x,y){
			var index = y*mapWidth + x;
			return map[index] || 0;
		}

		function setCell(x,y,v){
			var index = y*mapWidth + x;
			v=v||0;
			changeMap[index] = true;
			map[index] = v;
		}

		function isChanged(x,y){
			var index = y*mapWidth + x;
			return changeMap[index]
		}

		function drawCell(x,y,color){
			var index = y*mapWidth + x;
			changeMap[index] = false;

			x=x*gridsize;
			y=y*gridsize;
			var g = gridsize;
			if (showGrid){
				x++; y++; g-=2;
			}
			

			ctx.clearRect(x,y,g,g);
			
			if (typeof color === "string"){
				ctx.fillStyle = color;
				ctx.fillRect(x,y,g,g);
			}else{
				fontMed.write(ctx,""+color,x,y);
				fontMed.write(ctx,""+color,x,y);
			}
			
		}
		
		function drawGrid(){
			var w = mapWidth*gridsize;
			var h = mapHeight*gridsize;

			ctx.strokeStyle = "#3d4c6e";
			ctx.beginPath();
			for (var x=0; x<=mapWidth; x++){
				ctx.moveTo(x*gridsize, 1);
				ctx.lineTo(x*gridsize, h);
			}

			for (var y=0; y<=mapHeight; y++){
				ctx.moveTo(1, y*gridsize);
				ctx.lineTo(w, y*gridsize);
			}
			ctx.stroke();
			gridDrawn = true;

		}

		function drawBorder(){
			var w = mapWidth*gridsize;
			var h = mapHeight*gridsize;
			ctx.strokeStyle = "#53638f";
			ctx.beginPath();
			ctx.moveTo(1,1);
			ctx.lineTo(w,1);
			ctx.lineTo(w,h);
			ctx.lineTo(1,h);
			ctx.lineTo(1,1);
			ctx.stroke();
			gridDrawn = true;

		}
		
		function placeNumber(){
			var v=1;
			var x,y;
			do{
				x= Math.floor(Math.random()*mapWidth);
				y= Math.floor(Math.random()*mapHeight);
				v = cell(x,y);
			}while (v);
			
			setCell(x,y,currentNumber);
		}
		
		function oppositeDirection(_direction){
			switch (_direction){
				case DIRECTION.LEFT: return DIRECTION.RIGHT;
				case DIRECTION.RIGHT: return DIRECTION.LEFT;
				case DIRECTION.UP: return DIRECTION.DOWN;
				case DIRECTION.DOWN: return DIRECTION.UP;
			}
		}
		
		function snakeLength(){
			var c = currentNumber-1;
			return Math.floor(5 + c * (1+(c*1.5)));
		}
		
		return game;
	};
	
	var GameControls = function(){
		var gameControls = {};
		var game;
		var highScore;
		
		// setup UI
		var line1 = host.UI.image(0,0,2,160,"line_ver");
		var lineOptions = host.UI.image(0,0,2,160,"line_ver");
		line1.scale= lineOptions.scale="stretch";

		var infoPanel = host.UI.scale9Panel(0,0,20,20,host.UI.Assets.panelMainScale9);
		infoPanel.ignoreEvents = true;

		var infoLabel = host.UI.label( {textAlign:"center",label: "Ready Player 1?",font:fontFT});

		var mainButton = host.UI.button(0,0,100,20);
		mainButton.setProperties({
			label: "Start",
			textAlign:"center",
			background: host.UI.Assets.buttonLightScale9,
			hoverBackground: host.UI.Assets.buttonLightHoverScale9,
			font:window.fontMed,
			zIndex: 10
		});
		mainButton.onClick = function(){
			game.onClick();
		}

		var exitButton = host.UI.button(0,0,100,20);
		exitButton.setProperties({
			label: "Exit",
			textAlign:"center",
			background: host.UI.Assets.buttonLightScale9,
			hoverBackground: host.UI.Assets.buttonLightHoverScale9,
			font:window.fontMed,
			zIndex: 10
		});
		exitButton.onClick = function(){
			host.EventBus.trigger(host.EVENT.command,host.COMMAND.showMain);
		}
		var highScoreButton = host.UI.button(0,0,100,20);
		highScoreButton.setProperties({
			label: "HighScore",
			textAlign:"center",
			background: host.UI.Assets.buttonLightScale9,
			hoverBackground: host.UI.Assets.buttonLightHoverScale9,
			font:window.fontMed,
			zIndex: 10
		});
		highScoreButton.onClick = function(){
			game.toggleHighScore();
		}

		var labelBoxOptions = host.UI.scale9Panel(0,0,20,20,host.UI.Assets.panelDarkGreyScale9);
		labelBoxOptions.ignoreEvents = true;
		var labelOptions = host.UI.label();
		labelOptions.setProperties({
			label: "Options",
			font: fontSmall
		});

		var labelBoxDifficulty = host.UI.scale9Panel(0,0,20,20,host.UI.Assets.panelDarkGreyScale9);
		labelBoxDifficulty.ignoreEvents = true;
		var labelDifficulty = host.UI.label();
		labelDifficulty.setProperties({
			label: "Difficulty",
			font: fontSmall
		});

		var radioGroup = host.UI.radioGroup();
		radioGroup.setProperties({
			align: "left",
			size:"med",
			font: fontFT,
			highLightSelection:false,
			zIndex: 1
		});
		radioGroup.setItems([
			{label:"Novice"},
			{label:"Average", active:true},
			{label:"Pro"},
			{label:"Triton"}
		]);
		radioGroup.onChange = function(selectedIndex){
			var delay = 180;
			if (selectedIndex === 1) delay = 100;
			if (selectedIndex === 2) delay = 75;
			if (selectedIndex === 3) delay = 40;
			game.setSpeed(delay);
		};

		var wrapCheckbox = host.UI.checkbox();
		wrapCheckbox.onToggle = function(v){
			game.setWrap(v);
		}
		var wrapLabel = host.UI.label({
			label:"Wrap",
			font: fontMed,
			width:60
		});
		wrapLabel.onClick = function(){
			wrapCheckbox.toggle();
		}

		var gridCheckbox = host.UI.checkbox();
		gridCheckbox.checked = true;
		gridCheckbox.onToggle = function(v){
			game.setGrid(v);
		}
		var gridLabel = host.UI.label({
			label:"Grid",
			font: fontMed,
			width:60
		});
		gridLabel.onClick = function(){
			gridCheckbox.toggle();
		}

		var logo = host.UI.image(0,0,10,10,"Nibbles.logo");
		logo.scale = "none";
		logo.ignoreEvents = true;


		var backgroundPanel = host.UI.scale9Panel(0,0,20,20,{
			img: host.Y.getImage("panel_dark"),
			left:3,
			top:3,
			right:2,
			bottom: 2
		});

		var scoreBoard = host.UI.panel();
		scoreBoard.ignoreEvents = true;
		scoreBoard.hide();

		scoreBoard.onResize = function(){

			var colH = Math.floor(scoreBoard.height/3);
			var boxMargin = (colH-32)>>1;
			var labelMargin = boxMargin;

			player1.setSize(scoreBoard.width,colH);
			
			
			var labelFont = fontBig;
			var ledFont = fontLedBig;
			var labelWidth = 72;
			var ledMargin = 6;
			
			if (scoreBoard.width<200){
				labelFont = fontMed;
				ledFont = fontLed;
				labelWidth = 58;
				ledMargin = 2;
			}

			if (scoreBoard.width<150){
				labelWidth = 0;
				ledMargin = 2;
				boxMargin = colH-32;
				labelMargin = 0;
			}

			scoreBackground.setProperties({
				width: scoreBoard.width - labelWidth,
				height: 32,
				left:labelWidth-4,
				top: colH + boxMargin
			})
			scoreNumber.setProperties({
				width: scoreBackground.width,
				height: 32,
				left:scoreBackground.left,
				top: scoreBackground.top - ledMargin,
				font: ledFont
			})
			scoreLabel.setProperties({
				width: 100,
				height: 32,
				left:-4,
				top: colH + labelMargin,
				font: labelFont
			})

			livesBackground.setProperties({
				width: scoreBackground.width,
				height: scoreBackground.height,
				left: scoreBackground.left,
				top: colH*2 + boxMargin
			})
			livesNumber.setProperties({
				width: scoreNumber.width,
				height: scoreNumber.height,
				left: scoreNumber.left,
				top:livesBackground.top-ledMargin,
				font: ledFont
			})
			livesLabel.setProperties({
				width: scoreLabel.width,
				height: scoreLabel.height,
				left: scoreLabel.left,
				top: colH*2 + labelMargin,
				font: labelFont
			})
			s_line1.setProperties({
				width: scoreBoard.width,
				height: 2,
				left: 0,
				top: colH
			})
			s_line2.setProperties({
				width: scoreBoard.width,
				height: 2,
				left: 0,
				top: colH*2
			})


		}

		var player1 = host.UI.image(0,0,10,10,"Nibbles.player1");
		player1.scale = "none";

		var insetScale9 = {top:5,left:5,right:5,bottom:5,img:host.Y.getImage("panel_inset_dark_inactive")};
		var scoreBackground = host.UI.scale9Panel(0,0,50,20,insetScale9);
		var livesBackground = host.UI.scale9Panel(0,0,50,20,insetScale9);

		var scoreNumber = host.UI.label({
			textAlign:"right",
			label: "",
			font:fontLedBig
		});
		var livesNumber = host.UI.label({
			textAlign:"right",
			label: "",
			font:fontLedBig
		});
		var scoreLabel = host.UI.label({
			textAlign:"left",
			label: "Score",
			font:fontBig
		});
		var livesLabel = host.UI.label({
			textAlign:"left",
			label: "Lives",
			font:fontBig
		});
		var s_line1 = host.UI.image(0,0,2,160,"line_hor");
		var s_line2 = host.UI.image(0,0,2,160,"line_hor");


		scoreBoard.addChild(s_line1);
		scoreBoard.addChild(s_line2);
		scoreBoard.addChild(player1);
		scoreBoard.addChild(scoreBackground);
		scoreBoard.addChild(scoreNumber);
		scoreBoard.addChild(scoreLabel);
		scoreBoard.addChild(livesBackground);
		scoreBoard.addChild(livesNumber);
		scoreBoard.addChild(livesLabel);


		
		gameControls.hideInfo = function(){
			infoPanel.hide();
			infoLabel.hide();
			mainButton.hide()
		}

		gameControls.showInfo = function(text,label){
			infoPanel.show();
			if (text) infoLabel.setLabel(text);
			infoLabel.show();
			if (label) mainButton.setLabel(label);
			mainButton.show()
		}
		
		gameControls.resize = function(){

			if (host.Layout.prefered === "col3"){
				if (scoreBoard.isVisible()){
					gameControls.hideConfig();
				}
				
				line1.hide();

				backgroundPanel.setPosition(2,0);
				backgroundPanel.setSize(host.Layout.col32W+4,renderTarget.height+4);

				logo.setPosition(-2000,0);

				scoreBoard.setProperties({
					width: host.Layout.col31W,
					height:renderTarget.height,
					left:host.Layout.col33X,
					top: 0
				})

				var panelWidth = Math.min(250,host.Layout.col32W);
				var buttonWidth = Math.min(200,panelWidth-4);

				var panelMargin = Math.max(0,(host.Layout.col32W-panelWidth)>>1);
				var buttonMargin = Math.max(0,(host.Layout.col32W-buttonWidth)>>1);

				infoPanel.setSize(panelWidth,80);
				infoPanel.setPosition(host.Layout.col31X + panelMargin,renderTarget.height - 100);
				infoLabel.setSize(panelWidth,40);
				infoLabel.setPosition(host.Layout.col31X + panelMargin,renderTarget.height - 90);

				mainButton.setProperties({
					left: host.Layout.col31X + buttonMargin,
					top: renderTarget.height - 50,
					width: buttonWidth,
					height: 24
				})

				// options
				var halfColW = (host.Layout.col31W>>1) - 1;
				lineOptions.setPosition(host.Layout.col33X+halfColW,2);

				labelBoxOptions.setSize(halfColW,20);
				labelOptions.setSize(halfColW,20);
				labelBoxOptions.setPosition(host.Layout.col33X+2,2);
				labelOptions.setPosition(host.Layout.col33X+2,5);

				labelBoxDifficulty.setSize(halfColW,20);
				labelDifficulty.setSize(halfColW,20);
				labelBoxDifficulty.setPosition(host.Layout.col33X + halfColW+1,2);
				labelDifficulty.setPosition(host.Layout.col33X + halfColW +2,5);

				wrapCheckbox.setPosition(host.Layout.col33X + 10,30 + 2);
				wrapLabel.setPosition(host.Layout.col33X + 20,30+ 2);
				gridCheckbox.setPosition(host.Layout.col33X + 10,30 + 20+ 2);
				gridLabel.setPosition(host.Layout.col33X + 20,30 + 20+ 2);
				wrapLabel.setProperties({font:fontSmall});
				gridLabel.setProperties({font:fontSmall});

				radioGroup.setSize(halfColW,80);
				radioGroup.setPosition(host.Layout.col33X + halfColW+2,30);
				radioGroup.setProperties(
					{size: "small"}
				)

				highScoreButton.setProperties({
					left: host.Layout.col33X +1,
					top: renderTarget.height - 24,
					width: halfColW,
					height: 24
				});
				exitButton.setProperties({
					left: host.Layout.col33X + halfColW + 3,
					top: renderTarget.height - 24,
					width: halfColW,
					height: 24
				});

			}else{
				gameControls.showConfig();

				line1.show();
				line1.setPosition(host.Layout.col2X-2,0);

				backgroundPanel.setPosition(host.Layout.col2X,0);
				backgroundPanel.setSize(host.Layout.col3W+4,renderTarget.height+4);

				// logo
				logo.setProperties({
					width: host.Layout.col1W - 4,
					height: renderTarget.height - 4,
					left:host.Layout.col1X+2,
					top: 2
				});
				scoreBoard.setProperties({
					width: host.Layout.col1W,
					height:renderTarget.height,
					left:host.Layout.col1X,
					top: 0
				})

				var panelWidth = Math.min(250,host.Layout.col3W);
				var buttonWidth = Math.min(200,panelWidth-4);

				var panelMargin = Math.max(0,(host.Layout.col3W-panelWidth)>>1);
				var buttonMargin = Math.max(0,(host.Layout.col3W-buttonWidth)>>1);

				infoPanel.setSize(panelWidth,80);
				infoPanel.setPosition(host.Layout.col2X + panelMargin,renderTarget.height - 100);
				infoLabel.setSize(panelWidth,40);
				infoLabel.setPosition(host.Layout.col2X + panelMargin,renderTarget.height - 90);

				mainButton.setProperties({
					left: host.Layout.col2X + buttonMargin,
					top: renderTarget.height - 50,
					width: buttonWidth,
					height: 24
				})

				// options
				var halfColW = (host.Layout.col1W>>1) - 1;
				lineOptions.setPosition(host.Layout.col5X+halfColW,2);

				labelBoxOptions.setSize(halfColW,20);
				labelOptions.setSize(halfColW,20);
				labelBoxOptions.setPosition(host.Layout.col5X+2,2);
				labelOptions.setPosition(host.Layout.col5X+2,5);

				labelBoxDifficulty.setSize(halfColW,20);
				labelDifficulty.setSize(halfColW,20);
				labelBoxDifficulty.setPosition(host.Layout.col5X + halfColW+1,2);
				labelDifficulty.setPosition(host.Layout.col5X + halfColW +2,5);

				wrapCheckbox.setPosition(host.Layout.col5X + 10,30 + 2);
				wrapLabel.setPosition(host.Layout.col5X + 20,30+ 2);
				gridCheckbox.setPosition(host.Layout.col5X + 10,30 + 20+ 2);
				gridLabel.setPosition(host.Layout.col5X + 20,30 + 20+ 2);

				radioGroup.setSize(halfColW,80);
				radioGroup.setPosition(host.Layout.col5X + halfColW+2,30);

				highScoreButton.setProperties({
					left: host.Layout.col5X +1,
					top: renderTarget.height - 24,
					width: halfColW,
					height: 24
				});
				exitButton.setProperties({
					left: host.Layout.col5X + halfColW + 3,
					top: renderTarget.height - 24,
					width: halfColW,
					height: 24
				});
			}
			
			highScoreButton.setLabel(highScoreButton.width<100?"High":"HighScore");

		}

		gameControls.setScore = function(score){
			if (typeof score === "undefined"){
				logo.hide();
				scoreBoard.show();
				score= 0;
			}
			
			var s = "" + score;
			var len = Math.floor(scoreNumber.width/(scoreNumber.getFont().charWidth + 2)) ;
			while(s.length<len){s=" "+s}
			scoreNumber.setLabel(s);
		}

		gameControls.setLives = function(lives){
			var s = "" + lives;
			var len = Math.floor(livesNumber.width/16);
			while(s.length<len){s=" "+s}
			livesNumber.setLabel(s);
		}
		
		gameControls.attach = function(_game){
			game = _game;
			game.setControls(gameControls);

			renderTarget.addChild(backgroundPanel);
			renderTarget.addChild(line1);

			renderTarget.addChild(game);
			
			renderTarget.addChild(infoPanel);
			renderTarget.addChild(infoLabel);
			renderTarget.addChild(mainButton);
			
			renderTarget.addChild(labelBoxOptions);
			renderTarget.addChild(labelOptions);
			renderTarget.addChild(labelBoxDifficulty);
			renderTarget.addChild(labelDifficulty);
			renderTarget.addChild(radioGroup);
			renderTarget.addChild(wrapCheckbox);
			renderTarget.addChild(wrapLabel);
			renderTarget.addChild(gridCheckbox);
			renderTarget.addChild(gridLabel);
			renderTarget.addChild(highScoreButton);
			renderTarget.addChild(exitButton);
			renderTarget.addChild(lineOptions);

			renderTarget.addChild(logo);
			renderTarget.addChild(scoreBoard);
		}

		gameControls.showConfig = function(){
			highScoreButton.show();
			exitButton.show();
			radioGroup.show();
			labelBoxOptions.show();
			labelOptions.show();
			labelBoxDifficulty.show();
			labelDifficulty.show();
			wrapCheckbox.show();
			wrapLabel.show();
			gridCheckbox.show();
			gridLabel.show();
			lineOptions.show();
		}

		gameControls.hideConfig = function(){
			highScoreButton.hide();
			exitButton.hide();
			radioGroup.hide();
			labelBoxOptions.hide();
			labelOptions.hide();
			labelBoxDifficulty.hide();
			labelDifficulty.hide();
			wrapCheckbox.hide();
			wrapLabel.hide();
			gridCheckbox.hide();
			gridLabel.hide();
			lineOptions.hide();
		}
		
		return gameControls;
	}
	
	me.init = function(mapping){
		console.log("Init Nibbles");
		host = mapping;
		host.Input.setFocusElement(me);

		if (renderTarget){
			// already running
			return;
		}
		var game = Game();
		var gameControls = GameControls();
		var prevKeyTime = 0;
		var keyWord = "";

		game.hideInfo = function(){
			gameControls.hideInfo();
		}

		game.showInfo = function(text,label){
			gameControls.showInfo(text,label);
		}

		me.onKeyDown = function(keycode){
			var time = Date.now();
			var delta = time-prevKeyTime;
			if (delta>2000) keyWord="";
			prevKeyTime=time;
			switch (keycode){
				case 13:
					game.onClick();
					break;
				case DIRECTION.LEFT:
				case DIRECTION.UP:
				case DIRECTION.RIGHT:
				case DIRECTION.DOWN:
					game.move(keycode)
					break;
				default:
					if (host.Input.isMetaKeyDown() && keycode>=65 && keycode<=90){
						//delta = String.fromCharCode()
						keyWord += String.fromCharCode(keycode);
						if (keyWord === "SKIP"){
							game.won();
						}
						if (keyWord === "TRITON"){
							gameControls.setLives(99999999);
						}
					}else{
						keyWord = "";
					}

			}
			return true
		}

		me.resize = function(){
			gameControls.resize();
			game.resize();
		}
		

		host.EventBus.trigger(host.EVENT.pluginRenderHook,{
			target: "main",
			setRenderTarget:function(element){
				console.log("Set Nibbles render target to ",element);
				
				renderTarget = element;
				gameControls.attach(game);
				
				me.resize();
				host.Input.setFocusElement(me);

				renderTarget.onResize = function(){
					me.resize();
				}

				renderTarget.onHide = function(){
					console.log("Removing Nibbles");
					// destroy the instance and hooks on the renderTarget
					if (registeredRenderEvent) host.EventBus.off(host.EVENT.screenRender,registeredRenderEvent);
					registeredRenderEvent = null;
					host.Input.clearFocusElement();
					game = null;
					gameControls = null;
					renderTarget.onResize = null;
					renderTarget.onHide = null;
					renderTarget = null;
				}

				registeredRenderEvent = host.EventBus.on(host.EVENT.screenRender,function(){
					if (!renderTarget.isVisible()) return;
					beginStepTime = (performance || Date).now();
					var delta = (beginStepTime-lastStepTime);

					if (delta>frameTime){
						lastStepTime=beginStepTime;
						game.update();
					}
				});
			}
		});
	}
	return me;
}();