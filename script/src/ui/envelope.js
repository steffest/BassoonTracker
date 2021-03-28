UI.Envelope = function(type){

	var me = UI.element();
	me.type = type;

	var background = UI.scale9Panel(0,0,me.width,me.height,{
		img: Y.getImage("panel_dark"),
		left:3,
		top:3,
		right:2,
		bottom: 2
	});
	background.ignoreEvents = true;

	var currentInstrument;
	var currentEnvelope;
	var isDragging;
	var dragPoint;
	var activePoint;
	var activePointIndex = -1;
	var prevActivePointIndex;

	var xScale;
	var yScale;

	me.onResize = function(){
		xScale = me.width/324;
		yScale = me.height/64;
	};

	me.onHover = function(data){
		if (!isDragging){
			activePointIndex = -1;
			activePoint = undefined;

			if (currentEnvelope && currentEnvelope.enabled){

                var x = Math.round(me.eventX/xScale);
                var y = Math.round((me.height - me.eventY)/yScale);


				for (var i = 0, max = currentEnvelope.count; i<max; i++){
					var point = currentEnvelope.points[i] || [0,0];
					if (Math.abs(x - point[0])<6 && Math.abs(y - point[1])<6){
						activePointIndex = i;
						activePoint = {
							p: currentEnvelope.points[i],
							minY: 0,
							maxY: 64
						};
						if (i===0) {
							activePoint.minX = 0;
							activePoint.maxX = 0;
						}else{
							activePoint.minX = currentEnvelope.points[i-1][0];
							activePoint.maxX = 324;
							if (i<currentEnvelope.count-1) activePoint.maxX =  currentEnvelope.points[i+1][0]
						}
						break;
					}
				}

				if (prevActivePointIndex !== activePointIndex){
					prevActivePointIndex = activePointIndex;
					me.refresh();
				}
			}
		}

	};


	me.onDragStart = function(touchData){

		if (activePoint){
			dragPoint = {
				startX: touchData.startX,
				startY: touchData.startY,
				pX: activePoint.p[0],
				pY: activePoint.p[1]
			};
			isDragging = true;
		}

	};

	me.onDrag = function(touchData){
		if (isDragging){
			dragPoint.deltaX = (touchData.deltaX)/xScale;
			dragPoint.deltaY = (touchData.deltaY)/yScale;

			var newX = dragPoint.pX + dragPoint.deltaX;
			newX = Math.min(activePoint.maxX,newX);
			newX = Math.max(activePoint.minX,newX);

			var newY = dragPoint.pY - dragPoint.deltaY;
			newY = Math.min(activePoint.maxY,newY);
			newY = Math.max(activePoint.minY,newY);

			activePoint.p[0] = newX;
			activePoint.p[1] = newY;

			me.refresh();
		}
	};

	me.onTouchUp = function(touchData){
		isDragging = false;
	};

	me.setInstrument = function(instrument){
		currentInstrument = instrument;
		if (instrument){
			currentEnvelope = instrument[me.type + "Envelope"];
		}else{
			currentEnvelope = undefined;
		}
		me.refresh();
	};


	me.render = function(){

		if (this.needsRendering) {

			if (background.width !== me.width) background.setSize(me.width,me.height);
			me.ctx.drawImage(background.render(true),0,0,me.width,me.height);

			me.ctx.lineWidth = 1;

			if (me.type === "panning"){
				me.ctx.strokeStyle = "#4a7c92";
				me.ctx.setLineDash([1, 2]);
				y = Math.floor(me.height/2);
				me.ctx.beginPath();
				me.ctx.moveTo(0, y);
				me.ctx.lineTo(me.width, y);
				me.ctx.stroke();
			}

			if (currentEnvelope && currentEnvelope.count){

				var xScale = me.width/324;
				var yScale = me.height/64;


				me.ctx.strokeStyle = currentEnvelope.enabled ? 'rgba(120, 255, 50, 0.5)' : 'rgba(120, 120, 180, 0.5)';

				me.ctx.beginPath();
				me.ctx.setLineDash([]);

				for (var i = 0; i<currentEnvelope.count; i++){

					var co = currentEnvelope.points[i];
					if (co){
						var x = co[0] * xScale;
						var y = me.height - (co[1] * yScale);

						var size = 4;
						var color = currentEnvelope.enabled ? "#D2861B" : "#546888";

						if (i === activePointIndex){
							size = 6;
							color = "#FFFFFF";
						}

						me.ctx.fillStyle = color;

						if (i === 0){
							me.ctx.moveTo(x, y);
						}else{
							me.ctx.lineTo(x, y);
						}

						var h = size/2;
						me.ctx.fillRect(x-h, y-h, size, size);
					}

				}
				me.ctx.stroke();

				if (currentEnvelope.enabled){
					function drawLine(x){
						me.ctx.beginPath();
						me.ctx.moveTo(x, 0);
						me.ctx.lineTo(x, me.height);
						me.ctx.stroke();
					}

					if (currentEnvelope.sustain){
						var sustainPoint = currentEnvelope.points[currentEnvelope.sustainPoint || 0];
						if (sustainPoint){
							me.ctx.strokeStyle = "#67b6d2";
							me.ctx.setLineDash([1, 2]);
							drawLine(sustainPoint[0] * xScale);
						}
					}

					if (currentEnvelope.loop){
						me.ctx.strokeStyle = "#d2b637";
						me.ctx.setLineDash([1, 2]);

						var loopStartPoint = currentEnvelope.points[currentEnvelope.loopStartPoint || 0];
						var loopEndPoint = currentEnvelope.points[currentEnvelope.loopEndPoint || 0];
						if (loopStartPoint) drawLine(loopStartPoint[0] * xScale);
						if (loopEndPoint) drawLine(loopEndPoint[0] * xScale);


					}





				}



			}

		}
		this.needsRendering = false;


		me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);

	};

	return me;

};

