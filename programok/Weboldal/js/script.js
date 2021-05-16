'use strict';

//Load lines from _.csv to this array
let lines;

//Contains all the dates of trading data
let dates = null;

//Closeprices array in order of dates
let closePrices = [];

/*
 * Contains all the timestamps when the algorithm bought/sold stock
 * {date: ,
 * type: ,
 * wallet: ,
 * amount: ,
 * stock_price: }
 */
let exchangeArr = [];

//The data which is being processed can be limited for testing purpose
let dataLimit = {
    limit: false,
    quantity: 100000
};

/*
 * This object makes the algorithm wait <remainingWaitTime> iterations
 * After buying, the <remainingWaitTime> goint to be equals to <minimumWaitTime>
 */
let stopTrading = {
    minimumWaitTime: 10,
    remainingWaitTime: 0
};

let settings = {
    startingMoney: 10000,
    buyLimit: 2000
};

//If true, the console and GUI outputs are disabled
let disableOutput = false;

//Contains all the tickers from /stocks folder
let tickers = [];

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

//Loads all the tickers from the stocks folder, and sets up click actions
$(document).ready(function () {
    console.log("-> Program init started");
    $.ajax({
        url: "/stocks/",
        success: function (data) {
            $(data).find("td > a").each(function () {
                let file = $(this).attr("href").substr(1);
                file = file.substr(file.indexOf("/") + 1, file.lastIndexOf("/") - file.indexOf("/") - 1);

                if (file == ".." || file == "")
                    return;

                tickers.push(file);
                $("#stocks").append("<option>" + file + "</option>");
            });
        }
    });

    $('#dataLimitcb').click(function () {
        $("#dataLimit").prop('disabled', function (i, v) {
            return !v;
        });
    });

    $("#simulationFormToggler").click(function () {
        $("#simulationForm").slideToggle("slow");
    });

    $("#transactions").click(function () {
        $("#transactionsTableDiv").slideToggle("slow");
    });
});

let tickerIndex = 0;
let bestofthebest = {allGains: 0};

//It searches for the best ticker to use for optimization
async function searchForOptimum(csvArray = null) {
    if (csvArray == null) {
        let ticker = tickers[tickerIndex++];
        $("#stocks").val(ticker);
        await loadStock(weights);

        startGeneticAlgorithm();

        while (genetic.isProcessing)
            await sleep(1000);

        await generateStatistics(false, searchForOptimum);
    } else {
        let allGains = 0;
        for (let item of csvArray) {
            for (let number of item.data) {
                allGains += number;
            }
        }
        let tmp = {arr: csvArray, allGains: allGains, mutant: best_mutation.weights};
        if (bestofthebest.allGains < tmp.allGains) {
            bestofthebest = tmp;
        }
        console.log(tmp);

        if (tickerIndex == tickers.length) {
            console.log(bestofthebest);
            return;
        } else {
            searchForOptimum();
        }
    }
}

let toCSV = [];

let headers = {
    ticker: 'Ticker'
}

//Generating data for my charts in dissertation
async function generateStatistics(download, callback = () => {
}) {
    disableOutput = true;
    toCSV = [];
    let buyLimitArr = [2000, 4000, 6000, 8000, -1];

    for (let buyLimit of buyLimitArr)
        headers["Limit_" + buyLimit] = buyLimit

    for (let ticker of tickers) {
        $("#stocks").val(ticker);
        let result = [];
        for (let buyLimit of buyLimitArr) {
            $("#buyLimit").val(buyLimit);
            let tmp = await loadStock(weights);
            result.push(tmp.money - settings.startingMoney);
        }

        toCSV.push({
            ticker: ticker,
            data: result
        });
    }

    if (download) exportCSVFile(headers, toCSV, "export");

    disableOutput = false;
    callback(toCSV);
}

//Makes the date two digits
function extendDate(num) {
    if (num < 10)
        return "0" + num;
    return num;
}

function formatDate(d) {
    return d.getFullYear() + ". " + extendDate(d.getMonth() + 1) + ". " + extendDate(d.getDate()) + " " + extendDate(d.getHours()) + ":" + extendDate(d.getMinutes())
}

function disableButtons() {
    $("#loadBtn").prop("disabled", true);
    $("#geneticBtn").prop("disabled", true);
    $("#loadBtnText").text("Folyamatban...");
    $("#spinner").prop("hidden", false);
}

function enableButtons() {
    $("#loadBtn").prop("disabled", false);
    $("#geneticBtn").prop("disabled", false);
    $("#loadBtnText").text("Indítás");
    $("#spinner").prop("hidden", true);
}

function reset() {
    lines = null;
    dates = null;

    closePrices = [];
    exchangeArr = [];

    dataLimit = {limit: false, quantity: 100000};
    stopTrading = {minimumWaitTime: 10, remainingWaitTime: 0};

    settings = {
        startingMoney: 10000,
        buyLimit: 2000
    }

    wallet = undefined;
    stocks = 0;

    macdSignalIsLower = undefined;
    sma50IsLower = undefined;

    lastBuy = undefined;

    $("#chartdiv").prop("hidden", true);
    $("#indicators").prop("hidden", true);
}

function loadStock(mutant = null) {
    return new Promise((resolve) => {
        if (genetic.isProcessing && mutant != null && dates != null) {
            let stats = {
                money: 0
            }

            dataLimit = {limit: false, quantity: 100000};

            stopTrading = {minimumWaitTime: 10, remainingWaitTime: 0};

            settings.startingMoney = $("#startMoney").val();
			settings.buyLimit = parseFloat($("#buyLimit").val());

            wallet = undefined;
            stocks = 0;

            macdSignalIsLower = undefined;

            sma50IsLower = undefined;

            lastBuy = undefined;

            stats.money = exchange(settings.startingMoney, mutant);

            enableButtons();

            resolve(stats);
            return;
        }

        if (mutant != null && dates != null)
            reset();

        disableButtons();

        settings.startingMoney = $("#startMoney").val();
        settings.buyLimit = parseFloat($("#buyLimit").val());

        dataLimit.limit = $('#dataLimitcb').prop("checked");
        dataLimit.quantity = $("#dataLimit").val();

        let stock = $("#stocks option:selected").text();
		
		console.log(stock);

        $.ajax({
            type: "GET",
            url: "stocks/" + stock + "/" + stock + ".csv",
            dataType: "text",
            success: function (data) {
                processData(data);
            }
        }).then(() => {
            dates = [];

            if (!disableOutput)
                console.log("-> " + stock + " Stock data loaded");
            for (let i = 0; i < lines.length; i++) {
                dates.push(Date.parse(lines[i][0]));
                closePrices.push(parseFloat(lines[i][4]));
            }

            lines = [];

            reCalculate().then(() => {
                let stats = {
                    money: 0
                }

                if (!disableOutput)
                    console.log("-> Starting to trade");

                stats.money = exchange(settings.startingMoney, mutant);

                if (!disableOutput)
                    console.log("-> Trading finished successfully");

                if (!disableOutput) {
                    console.log("Kezdő összeg: " + settings.startingMoney);
                    console.log("Átlag pénz a vásárlások végén: " + stats.money);

                    $("#result").removeClass("alert-success");
                    $("#result").removeClass("alert-danger");

                    if (settings.startingMoney < stats.money)
                        $("#result").addClass("alert-success");
                    else
                        $("#result").addClass("alert-danger");

                    $("#result").text("Végösszeg: " + Math.round(stats.money) + "$");
                    $("#transactions").text(exchangeArr.length + "db tranzakció történt.");
                    $("#transactions").prop("hidden", false);
                    let counter = 1;

                    $("#transactionsTable > tbody")[0].innerHTML = "";
                    for (let tr of exchangeArr) {
                        $("#transactionsTable").append('<tr><th scope="row">' + (counter++) +
                            '</th><td>' + formatDate(new Date(tr.date)) +
                            '<td>' + ((tr.type == "buy") ? 'Vásárlás' : 'Eladás') +
                            '<td>' + tr.amount +
                            '<td>' + parseFloat(tr.stock_price.toFixed(6)) +
                            '<td>' + parseFloat((tr.stock_price * tr.amount).toFixed(2)) + '</tr>');
                    }

                }
                enableButtons();

                if (!disableOutput)
                    loadChart2(stock);

                resolve(stats);
            });
        });
    });
}

//Splitting the csv data into lines
function processData(allText) {
    lines = [];
    let allTextLines = allText.split(/\r\n|\n/);
    let headers = allTextLines[0].split(',');

    for (let i = allTextLines.length - 1; i > 0; i--) {
        let data = allTextLines[i].split(',');
        if (data.length == headers.length) {

            let tarr = [];
            for (let j = 0; j < headers.length; j++) {
                tarr.push(data[j]);
            }

            if (dataLimit.limit) {
                if (lines.length >= dataLimit.quantity)
                    break;
            }

            lines.push(tarr);
        }
    }

    allTextLines = null;
}

/*
 * For any given A and B arrays with the same lenght,
 * the algorithm will calculate A-B
 */
function subtractArrays(a, b) {
    let x = [];

    if (a.length != b.length)
        return null;

    for (let i = 0; i < a.length; i++) {
        x.push(parseFloat(a[i]) - parseFloat(b[i]));
    }

    return x;
}

/*
 * This algorithm will set the data length of A equals to B,
 * so they are going to have exactly the same number of zeros
 * in the beginning.
 *
 * A =      [0, 0, 1, 2, 3, 4]
 * B =      [0, 0, 0, 0, 1, 2]
 * Output = [0, 0, 0, 0, 3, 4]
 */
function setToExactSize(a, b) {
    let x = [];

    for (let i = 0; i < b.length; i++) {
        if (b[i] == 0) {
            x.push(0);
        } else {
            x.push(a[i]);
        }
    }

    return x;
}

/*
 * This algoritm will merge two arrays
 * A =      [1, 2, 3, 4]
 * B =      [5, 6, 7, 8]
 * Output = [[1, 5], [2, 6], [3, 7], [4, 8]]
 */
function merge(_key, _value) {
    let result = [];
    _key.forEach((key, i) => result[i] = [_key[i], _value[i]]);
    return result;
}

/*
 * Exchange array has two types: buy and sell
 * This algorithm will separate them, and give back the date and the price of the transaction
 */
function separateExchangeArray(type) {
    let temp = [];
    exchangeArr.forEach((key, i) => {
        if (key.type == type) temp.push([key.date, key.stock_price])
    });
    return temp;
}

function getEverynth(array, step) {
    let tmp = [];
    for (let i = 0; i < array.length; i += step)
        tmp.push(array[i]);

    return tmp;
}

let chart;

function loadChart2(stock) {
	//The step variable limit the number of points. (Point / step) 
    let step = 1;
	let fontsize = '20px';
	
    Highcharts.setOptions({
        global: {
            useUTC: false
        }
    });
    chart = Highcharts.stockChart('container', {
        rangeSelector: {
            selected: 0
        },
        yAxis: [{
            height: '40%',
            labels: {
                align: 'right',
                x: -3,
				style: {
					fontSize: fontsize,
					color: '#000000'
				}
            },
            title: {
                text: 'Stock',
				style: {
					fontSize: fontsize,
					color: '#000000'
				}
            }
        }, {
            top: '40%',
            height: '30%',
            labels: {
                align: 'right',
                x: -3,
				style: {
					fontSize: fontsize,
					color: '#000000'
				}
            },
            offset: 0,
            title: {
                text: 'RSI',
				style: {
					fontSize: fontsize,
					color: '#000000'
				}
            },
            plotBands: [{
                from: 30,
                to: 70,
                color: 'rgba(68, 170, 213, 0.2)'
            }]
        }, {
            top: '70%',
            height: '30%',
            labels: {
                align: 'right',
                x: -3,
				style: {
					fontSize: fontsize,
					color: '#000000'
				}
            },
            offset: 0,
            title: {
                text: 'MACD',
				style: {
					fontSize: fontsize,
					color: '#000000'
				}
            }
        }],
        title: {
            text: stock + ' Stock Price',
				style: {
					fontSize: fontsize,
					color: '#000000'
				}
        },
        xAxis: {
            categories: dates,
			labels: {
                style: {
                    fontSize: fontsize,
					color: '#000000'
                }
            }
        },
        legend: {
            align: 'center',
            verticalAlign: 'top',
            enabled: true,
			itemStyle: {
                fontSize: fontsize,
				color: '#000000'
            }
        },
        series: [
            {
                name: stock,
                data: getEverynth(merge(dates, closePrices), step),
                tooltip: {
                    valueDecimals: 2
                },
				color: '#000000'
            },
            {
                name: 'SMA 50',
                data: getEverynth(merge(dates, sma50Arr), step),
				color: '#ff0000'
            },
            {
                name: 'SMA 200',
                data: getEverynth(merge(dates, sma200Arr), step),
				color: '#0000ff'
            },
            {
                name: 'RSI',
                yAxis: 1,
                data: getEverynth(merge(dates, rsiArr), step),
				color: '#000000'
            },
            {
                name: 'MACD',
                yAxis: 2,
                data: getEverynth(merge(dates, macdArr), step),
				color: '#000000'
            },
            {
                name: 'Signal',
                yAxis: 2,
                data: getEverynth(merge(dates, macdSignalArr), step),
				color: '#ff0000'
            },
            {
                name: 'Buy',
                data: separateExchangeArray("buy"),
                lineWidth: 0,
                marker: {
                    enabled: true,
                    radius: 5,
                    fillColor: "#00FF00",
					lineWidth: 1,
					lineColor: "#000000"
                },
                tooltip: {
                    valueDecimals: 2
                },
                states: {
                    hover: {
                        lineWidthPlus: 0
                    }
                }
            },
            {
                name: 'Sell',
                data: separateExchangeArray("sell"),
                lineWidth: 0,
                marker: {
                    enabled: true,
                    radius: 5,
                    fillColor: "#FF0000",
					lineWidth: 1,
					lineColor: "#000000"
                },
                tooltip: {
                    valueDecimals: 3
                },
                states: {
                    hover: {
                        lineWidthPlus: 0
                    }
                }
            }]
    });
}

let wallet; // $
let stocks = 0;

function macdRising(point) {
    let offset = 20;
    let step = 2;

    let reading = macdArr[point - offset];
    let gain = 0;
    let drop = 0;

    for (let i = point - offset; i < point; i += step) {
        if (drop < 2) {
            gain = macdArr[i] - reading;

            if (gain >= 0) {
                (drop > 0) ? drop-- : drop = 0;
                continue;
            }

            drop++;
        } else {
            return false;
        }
    }

    return true;
}

let macdSignalIsLower;
let sma50IsLower;

function macdSignalTest(point) {
    if ((macdSignalIsLower && macdArr[point] < macdSignalArr[point]) || (!macdSignalIsLower && macdArr[point] >= macdSignalArr[point])) {
        macdSignalIsLower = !macdSignalIsLower;
        return true;
    }
    return false;
}

function smaSignalTest(point) {
    if ((sma50IsLower && sma200Arr[point] < sma50Arr[point]) || (!sma50IsLower && sma200Arr[point] >= sma50Arr[point])) {
        sma50IsLower = !sma50IsLower;
        return true;
    }
    return false;
}

let sma50Arr = [];
let sma200Arr = [];
let rsiArr = [];
let macdArr = [];
let macdSignalArr = [];

let lowEmaPeriod = 12;
let highEmaPeriod = 26;
let signalSmoothing = 9;

let lowEma = [];
let highEma = [];

function createWorker(i) {
    return new Promise(function (resolve) {
        let w = new Worker('/js/worker.js');

        w.postMessage(i);
        w.onmessage = function (event) {
            w.terminate();
            resolve(event.data);
        };
    });
}

function reCalculate() {
    return new Promise(function (resolve) {
        let promises = [];
        let message;
        let endPoint = dataLimit.limit ? dataLimit.quantity : closePrices.length;

        message = {type: "RSI", data: [closePrices, endPoint, 14]};
        promises.push(createWorker(message));

        message = {type: "EMA", data: [closePrices, endPoint, lowEmaPeriod]};
        promises.push(createWorker(message));

        message = {type: "EMA", data: [closePrices, endPoint, highEmaPeriod]};
        promises.push(createWorker(message));

        message = {type: "SMA", data: [closePrices, endPoint, 50]};
        promises.push(createWorker(message));

        message = {type: "SMA", data: [closePrices, endPoint, 200]};
        promises.push(createWorker(message));

        Promise.all(promises).then(function (data) {
            rsiArr = data[0];
            lowEma = data[1];
            highEma = data[2];

            sma50Arr = data[3];
            sma200Arr = data[4];

            lowEma = setToExactSize(lowEma, highEma);
            macdArr = subtractArrays(lowEma, highEma);

            message = {type: "EMA", data: [macdArr, endPoint, (highEmaPeriod + signalSmoothing)]};
            let promise = createWorker(message).then(function (data) {
                macdSignalArr = data;
                resolve();
            });
        });
    });
}

let decision = {
    buy: 0,
    sell: 0
};

function decisionTest() {
    if (decision.buy > decision.sell && decision.buy > 10)
        return "buy";

    if (decision.buy < decision.sell && decision.sell > 10)
        return "sell";

    return "";
}

function exchange(startingMoney, mutant = null) {
    wallet = parseFloat(startingMoney);
    stocks = 0;

    stopTrading.remainingWaitTime = stopTrading.minimumWaitTime;

    for (let i = 0; i < closePrices.length; i += 2) {
        if (sma200Arr[i] == 0)
            continue;

        if (stopTrading.remainingWaitTime > 0) {
            stopTrading.remainingWaitTime--;
            continue;
        }

        decision.buy = 0;
        decision.sell = 0;

        !isFinite(macdSignalIsLower) ? (macdSignalIsLower = (macdArr[i] > macdSignalArr[i])) : macdSignalIsLower;
        !isFinite(sma50IsLower) ? (sma50IsLower = (sma200Arr[i] > sma50Arr[i])) : sma50IsLower;

        smaSignalTest(i);

        if (sma50IsLower) {
            decision.buy += mutant[0];
        } else {
            decision.sell += mutant[1];
        }

        if (macdSignalIsLower && macdSignalTest(i)) {
            decision.buy += mutant[2];
        } else if (!macdSignalIsLower && macdSignalTest(i)) {
            decision.sell += mutant[3];
        }

        if (macdArr[i] > 0 || macdRising(i)) {
            decision.buy += mutant[4];
        }

        if (macdArr[i] < 0 || !macdRising(i)) {
            decision.sell += mutant[5];
        }

        if (rsiArr[i] < 30) {
            decision.buy += mutant[6];
        } else if (rsiArr[i] > 70) {
            decision.sell += mutant[7];
        }

        if (rsiArr[i] < 20) {
            decision.buy += mutant[8];
        } else if (rsiArr[i] > 80) {
            decision.sell += mutant[9];
        }

        if (isFinite(lastBuy) && lastBuy * 1.001 > stocks * closePrices[i])
            decision.sell += mutant[10];

        if (wallet > closePrices[i] && decisionTest() == "buy") {
            if (isFinite(lastBuy) && lastBuy * 0.998 < stocks * closePrices[i])
                continue;
            buy(closePrices[i], i);
        } else if (stocks > 0 && decisionTest() == "sell") {
            sell(closePrices[i], i);
        }

    }

    return (wallet + closePrices[closePrices.length - 1] * stocks);
}

let lastBuy;

function buy(stock_price, i) {
    let max = Math.floor(wallet * 0.999 / stock_price);
    let buy = max;
    if (settings.buyLimit != -1) {
        buy = Math.floor(settings.buyLimit / stock_price);
        buy = buy > max ? max : buy;
    }

    if (!(buy >= 1))
        return;

    stocks += buy;
    wallet -= buy * stock_price * 1.001;

    isFinite(lastBuy) ? lastBuy += buy * stock_price : lastBuy = buy * stock_price;

    stopTrading.remainingWaitTime = stopTrading.minimumWaitTime;

    if (!disableOutput)
        exchangeArr.push({date: dates[i], type: "buy", wallet: wallet, amount: buy, stock_price: stock_price});
}

function sell(stock_price, i) {
    let sell = stocks;
    wallet += sell * stock_price * 0.999;
    stocks -= sell;

    lastBuy = undefined;

    if (!disableOutput)
        exchangeArr.push({date: dates[i], type: "sell", wallet: wallet, amount: sell, stock_price: stock_price});
}
