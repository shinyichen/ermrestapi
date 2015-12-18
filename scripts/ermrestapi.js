/**
 * Created by jenniferchen on 12/9/15.
 */

var ermrestApp = angular.module("ermrestApp", []);

// ermrest service

ermrestApp.factory("ErmrestService", ['$http', '$q', function($http, $q) {

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
            schemas = response.data.schemas;
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
        var tableSchema = schemas[schemaName].tables[tableName];

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

        // primary key set
        var keys = tableSchema.keys[0].unique_columns;

        // create table object
        var table = new Table(schemaName, tableName, displayName, hidden, columns, keys);

        return table;
    }

    // TODO maintain path/url for each object

    var Table = function(schemaName, tableName, displayName, hidden, columns, keys) {
        this.path = baseUrl + "/entity/" + schemaName + ":" + tableName;
        this.schemaName = schemaName;
        this.tableName = tableName;
        this.displayName = displayName;
        this.hidden = hidden;
        this.columns = columns;
        this.keys = keys;
        this.filters = []; // always empty

        this.getRows = function() {
            var self = this;
            return $http.get(this.path).then(function(response) {
                var rows = [];
                for (var i = 0; i < response.data.length; i++) {
                    // get primary key columns that identifies the row
                    var ids = [];
                    for (var j = 0; j < self.keys.length; j++) {
                        ids[self.keys[j]] = response.data[i][self.keys[j]];
                    }
                    rows[i] = new Row(self, response.data[i], ids);
                }
                return rows;
            }, function(response) {
                return $q.reject(response.data);
            });
        }

        this.getFilteredTable = function(filters) {
            ftable = new FilteredTable(this, filters);
            return ftable;
        }
    }

    var FilteredTable = function(table, filters) {
        this.schemaName = table.schemaName;
        this.tableName = table.tableName;
        this.displayName = table.displayName;
        this.hidden = table.hidden;
        this.columns = table.columns;
        this.keys = table.keys;

        // append filters and path
        this.filters = table.filters;
        this.path = table.path;
        for (var i = 0; i < filters.length; i++) {
            this.filters.push(filters[i]);
            this.path = this.path + "/" + filters[i];
        }

        this.getRows = function() {
            var self = this;
            return $http.get(this.path).then(function(response) {
                var rows = [];
                for (var i = 0; i < response.data.length; i++) {
                    // get primary key columns that identifies the row
                    var ids = [];
                    for (var j = 0; j < self.keys.length; j++) {
                        ids[self.keys[j]] = response.data[i][self.keys[j]];
                    }
                    rows[i] = new Row(self, response.data[i], ids);
                }
                return rows;
            }, function(response) {
                return $q.reject(response.data);
            });
        }
    }

    var RelatedTable = function(row, s2, t2) {
        var row = row;
        this.path = row.path + "/" + s2 + ":" + t2;
    }

    // ids should point to a single row
    var Row = function(table, rowData, ids) {
        var table = table;
        this.data = rowData;
        this.path = table.path;
        for (id in ids) {
            this.path = this.path + "/" + id + "=" + ids[id];
        }

        this.getRelatedTable = function(s2, t2) {
            t2Schema = schemas[s2].tables[t2];
            return new RelatedTable(this, s2, t2);
        }
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

            ft1 = table.getFilteredTable(['id=1']);
            ft1.getRows().then(function(rows) {
               console.log(rows);
            });

            ft2 = table.getFilteredTable(["id::gt::1", "id::lt::20"]);
            ft2.getRows().then(function(rows) {
                var table2 = rows[0].getRelatedTable("assay", "replicate");
                console.log(table2.path);

            });

            ft3 = table.getFilteredTable(["library_type=biotin-labeled cRNA"]);
            ft3.getRows().then(function(rows) {
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

        ft1 = table.getFilteredTable([["id=1"]]);
        ft1.getRows().then(function(rows) {
            console.log(rows);
        });
    });

}]);

