/**
 * Created by jenniferchen on 12/9/15.
 */

var ermrestApp = angular.module("ermrestApp", []);

// ermrest service

ermrestApp.factory("ErmrestService", ['$http', function($http) {

    // private properties
    var catalog;
    var schemas;
    var baseUrl;

    // constructor
    // cid - catalog id
    var ErmrestService = function(ermrestLoc, cid) {
        catalog = cid;
        baseUrl = ermrestLoc + '/ermrest/catalog/' + cid;
    }

    ErmrestService.prototype.init = function() {
        // schema path
        var schemaPath = baseUrl + '/schema';

        // load schemas
        var self = this;
        return $http.get(schemaPath).then(function(response) {
            // set schemas
            self.schemas = response.data.schemas;
            for (var key in self.schemas) {
                self.schemas[key].catalog = self.catalog;
            }
            return response;
        }, function(response) {
            console.log("error loading schemas");
            return $q.reject(response.data);;
        });
    }

    // public getTable
    ErmrestService.prototype.getTable = function(schemaName, tableName) {
        var tableSchema = this.schemas[schemaName].tables[tableName];

        // table display name
        var displayName = tableSchema.table_name;
        var annotations = tableSchema.annotations;
        if (annotations['tag:misd.isi.edu,2015:display'] !== undefined &&
            annotations['tag:misd.isi.edu,2015:display'].name !== undefined) {
            displayName = annotations['tag:misd.isi.edu,2015:display'].name;
        }

        // hidden
        var hidden = false;
        if (annotations['tag:misd.isi.edu,2015:hidden'] !== undefined) {
            hidden = true;
        }

        // columns
        var columns = [];
        var columnDefinitions = tableSchema.column_definitions;
        for (var i = 0; i < columnDefinitions.length; i++){

            var cd = columnDefinitions[i];

            // hidden?
            var cHidden = false;
            if (cd.annotations['tag:misd.isi.edu,2015:hidden'] !== undefined) {
                cHidden = true;
            }

            // display name
            var cDisplayName = cd.name;
            if (cd.annotations['tag:misd.isi.edu,2015:display'] !== undefined && cd.annotations['tag:misd.isi.edu,2015:display'].name !== undefined) {
                cDisplayName = cd.annotations['tag:misd.isi.edu,2015:display'].name;
            }

            var column = new Column(cd.name, cDisplayName, cHidden);
            columns.push(column);
        }

        // create table object
        var table = new Table(schemaName, tableName, displayName, hidden, columns);

        return table;
    }

    var Table = function(schemaName, tableName, displayName, hidden, columns) {
        this.schemaName = schemaName;
        this.tableName = tableName;
        this.displayName = displayName;
        this.hidden = hidden;
        this.columns = columns;

        this.getRows = function() {
            var path = baseUrl + "/entity/" + schemaName + ":" + tableName;
            return $http.get(path).then(function(response) {
                var rows = [];
                for (var i = 0; i < response.data.length; i++) {
                    rows[i] = new Row(schemaName, tableName, response.data[i]);
                }
                return rows;
            }, function(response) {
                return $q.reject(response.data);
            });
        }
    }

    var Row = function(schemaName, tableName, rowData) {
        this.schemaName = schemaName;
        this.tableName = tableName;
        this.data = rowData;

    }

    var Column = function(name, displayName, hidden) {
        this.name = name;
        this.displayName = displayName;
        this.hidden = hidden;
    }

    return ErmrestService;
}]);


ermrestApp.service("ErmrestServiceFactory", ['$q', 'ErmrestService', function($q, ErmrestService) {

    var ermrestService; // keep single instance for now
    var loaded = false;

    this.createService = function(ermrestLoc, cid) {
        ermrestService = new ErmrestService(ermrestLoc, cid);
        return ermrestService.init().then(function(response) {
            loaded = true;
            console.log("service loaded");
            return ermrestService;
        }, function(response) {
            console.log ("error loading service");
            return ermrestService;
        });
    }

    this.getService = function() {

        // wait until ermrestService is loaded
        return $q(function(resolve, reject) {
            var check = setInterval(function() {
                if (loaded) {
                    clearInterval(check);
                    resolve(ermrestService);
                }
            }, 1000);
        });
    }

}]);



// tester

ermrestApp.controller('ermrestController1', ['ErmrestServiceFactory', function(ErmrestServiceFactory) {
    ErmrestServiceFactory.createService('https://dev.misd.isi.edu', 2).then(
        function(service) {
            ermrest = service;
            var table = ermrest.getTable('assay', 'library');
            table.getRows().then(function(rows) {
                console.log(rows);
            });
        }
    );
}]);

ermrestApp.controller('ermrestController2', ['ErmrestServiceFactory', function(ErmrestServiceFactory) {
    ErmrestServiceFactory.getService().then(function(service) {
        ermrest = service;

        var table = ermrest.getTable('isa_common', 'species');
        table.getRows().then(function(rows) {
            console.log(rows);
        }, function(response) {
            console.log("error loading table2")
        });
    });

}]);

