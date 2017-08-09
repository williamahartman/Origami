<?php include 'header.php';?>

<h3 class="centered" style="padding-top:2em;">CHAPTER III.</h3>
<h1>CREASE PATTERNS</h1>

<section id="intro">

	<div class="centered">
		<canvas id="canvas-1" resize></canvas>
	</div>

	<div class="centered">
		<pre><code><key>var</key> cp<key> = new</key> CreasePattern().<v>square</v>().<v>birdBase</v>()</code></pre>
	</div>
	<div class="explain">
		<p>A crease pattern</strong></p>
	</div>

	<div class="centered">
		<pre><code><key>var</key> cp<key> = new</key> CreasePattern().<v>rectangle</v>(width, height)</code></pre>
	</div>
	<div class="explain">
		<p>Can also take any shaped polygon, a series of points. This will only work with non-looping polygons that are wound clockwise.</strong></p>
	</div>

	<div class="centered">
		<pre><code><key>var</key> pointArray = [<br>&nbsp;<key>new</key> XYPoint(0.5, 0.5),<br>&nbsp;<key>new</key> XYPoint(0.0, 1.0), <br>&nbsp;<key>new</key> XYPoint(1.0, 1.0)<br>];<br><key>var</key> cp<key> = new</key> CreasePattern().<f>polygon</f>(pointArray)</code></pre>
	</div>

</section>

<script type="text/javascript" src="../tests/js/blank.js"></script>

<script>
var cp1 = new CreasePattern();
cp1.birdBase();
// cp1.generateFaces();

fillCanvasWithCP("canvas-1", cp1);
</script>

<?php include 'footer.php';?>