UI.WaveForm = function(){

	var me = UI.element();
	var currentSampleData;
	var currentSample;

	me.setSample = function(sample){
		currentSample = data;
		if (sample){
			currentSampleData = currentSampleData.data;
		}else{
			currentSampleData = undefined;
		}
		me.refresh();
	};

	me.render = function(){
		if (this.needsRendering) {
			console.error("render waveform",me.parent);

			me.ctx.fillStyle = "black";
			me.ctx.fillRect(0, 0, me.width, me.height);
			me.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';

			if (currentSampleData && currentSampleData.length && me.width){
				// sample 1 value each pixel
				var step = currentSampleData.length / me.width;
				var mid = me.height/2;

				me.ctx.beginPath();

				for (var i = 0; i<me.width; i++){
					var index = Math.floor(i*step);
					var peak = currentSampleData[index] * me.height;

					if(i === 0) {
						me.ctx.moveTo(i, mid + peak);
					} else {
						me.ctx.lineTo(i,mid + peak);
					}
				}

				me.ctx.stroke();
			}
		}
		this.needsRendering = false;

		me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);

	};

	return me;

};

