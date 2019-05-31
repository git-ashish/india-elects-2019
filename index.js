const rp = require('request-promise');  
const otcsv = require('objects-to-csv');  
const cheerio = require('cheerio');
const tabletojson = require('tabletojson');
const obj2csv = require('objects-to-csv');

const baseURL = 'http://results.eci.gov.in/pc/en/trends/';  
const defaultPage = 'statewiseU011.htm';
const staticText = 'statewise';
const aColumns = [ 'Constituency',
  'Const. No.',
  'Leading Candidate',
  'Leading Party',
  'Trailing Candidate',
  'Trailing Party',
  'Margin',
  'Status',
  'Winning Candidate',
  'Winning Party',
  'Margin'
];

// List of all available PC pages
// This includes all pages for a State
// For instance, Gujarat may have 3 or 4 pages
// 
const aListPageIDs = [],
aProcessedListPageIDs = [];

// Get a list of all states to go through
async function getStates() {  
  const html = await rp(baseURL + defaultPage);
  const controlID = '#ctl00_ContentPlaceHolder1_Result1_ddlState';
  const $ = cheerio.load(html);
  const aStates = [];
  
  $(controlID).find('option').each(function(i, elem) {

    let obj = {};

    obj[$(this).val()] = $(this).text();
    
    aStates[i] = obj;

    addPageIDToList($(this).val());

  });

  return aStates;
}

// Get Constituency data from a page
// 
async function getPCData(pageID) {

  const html = await rp(baseURL + getPageURL(pageID)),
  controlClass = '.table-party',
  $ = cheerio.load(html),
  rowsSelector = 'tr:nth-child(n+5)',
  aRows = [];

  // Push all pages
  // 
  getAllPages($);

  //get columns
  //
  /*
  $(controlClass).find('tr:nth-child(3) th').map(function(i, elem){

    var d = $(this);
    
    aColumns.push(d.text());

  });
  */

  $(controlClass).find(rowsSelector).each(function(i, elem) {

    let obj = {};

    // push State Code
    obj['State'] = pageID.slice(0, 3);

    $(this).find('> td').each(function(j, cell){

      let nestedCell,
      td = $(this);

      // In case the td has more metadata, like a nested table, 
      // only get the table's first row's first cell
      if ((nestedCell = td.find('> table > tbody > tr:first-child > td:first-child')).length) {
        obj[aColumns[j]] = nestedCell.text();
      }else{
        obj[aColumns[j]] = td.text();  
      }

    });
    
    aRows.push(obj);

  });

  return aRows;
}

function getPageURL(pageID) {
  return staticText + pageID + '.htm';
}

async function getDataForAllStates() {
  
  let dataset = [];

  // Loop over every state
  // 
  while(aListPageIDs.length){

    let pageID = aListPageIDs.shift();

    aProcessedListPageIDs.push(pageID);

    let aPageRows = await getPCData(pageID);

    dataset = dataset.concat(aPageRows);

    console.log(aListPageIDs.length, pageID, dataset.length);

  }

  const csvData = new otcsv(dataset);

  // Write data to disk
  // 
  return csvData.toDisk('./data/eci-pc-data.csv');

}

// function to get a list of pages for a PC
// 
function getAllPages($) {
  
  const pageListClass = '.nxt-c',
  aStateList = [];

  $(pageListClass).find('a').each(function(i, elem){
    let href = $(this).attr("href");
    
    aStateList.push(href.replace(staticText, ''));

    addPageIDToList(href.replace(staticText, ''));
  });

  return aStateList;

}

// Add a page ID to aListPageIDs
// 
function addPageIDToList(pageID) {

  let _cleanID = pageID.split('.')[0];

  if (aProcessedListPageIDs.indexOf(_cleanID) == -1 && aListPageIDs.indexOf(_cleanID) == -1 && pageID != 'Select State') {
    aListPageIDs.push(_cleanID);
  }
}

async function getAllParties() {

  const url = 'http://results.eci.gov.in/pc/en/partywise/allparty.htm',
  html = await rp(url),
  controlClass = '.table-party',
  $ = cheerio.load(html),
  rowsSelector = 'tr:nth-child(n+3)',
  aRows = [],
  cols = ['Party', 'Won', 'Leading', 'Total'];

  $(controlClass).find(rowsSelector).each(function(i, elem) {

    let obj = {};

    $(this).find('> td').each(function(j, cell){

      let nestedCell,
      td = $(this);

      obj[cols[j]] = td.text();

    });
    
    aRows.push(obj);

  });

  const csvData = new otcsv(aRows);

  // Write data to disk
  // 
  return csvData.toDisk('./data/eci-allparties-data.csv');


}


//--------------------------------
// 1. Get a list of all the states
// 
getStates().then(function(states){
  
  // Get data for all the states
  getDataForAllStates();

});

// 2. Get a list of all parties
// 
getAllParties();
