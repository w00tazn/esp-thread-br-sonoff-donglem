var OT_SERVER_PACKAGE_VERSION = "v1.0.0";
/* --------------------------------------------------------------------
                            action
-------------------------------------------------------------------- */
function frontend_click_for_more_form_param() {
  elem = document.getElementById("form-more-param");
  if (elem.style.display == 'block') {
    elem.style.display = 'none';
    document.getElementById('form-more-tip').innerHTML = "for more &#x21B5;";
  } else {
    elem.style.display = 'block';
    document.getElementById('form-more-tip').innerHTML = "for less &#x21B5;";
  }
}

function frontend_click_copy_network_info_to_form(arg) {
  var row = $(arg).parent().parent().find("td");
  if (row.eq(0) == "")
    return;
  var data = {
    id : row.eq(0).text(),
    network_name : row.eq(1).text(),
    extended_panid : row.eq(2).text(),
    panid : row.eq(3).text(),
    mac_address : row.eq(4).text(),
    channel : row.eq(5).text(),
    dBm : row.eq(6).text(),
    LQI : row.eq(7).text(),
  };

  document.getElementsByName("networkName")[0].value = data.network_name;
  document.getElementsByName("extPanId")[0].value = data.extended_panid;
  document.getElementsByName("panId")[0].value = data.panid;
  document.getElementsByName("channel")[0].value = data.channel;

  item = document.getElementById("form_tip");
  item.style.color = "blue";
  item.style.display = "block";
  item.innerHTML = "Form update.";
}

function frontend_log_show(title, arg) {

  document.getElementById("log_window_title").innerText = title;
  document.getElementById("log_window_title").style.fontSize = "25px";

  if (!arg.hasOwnProperty("error") || !arg.hasOwnProperty("content")) {
    document.getElementById("log_window").style.display = "flex";
    document.getElementById("log_window_content").innerText = "Unknown: ";
    return;
  }
  if (arg.error == 0)
    document.getElementById("log_window_content").style.color = "green";
  else
    document.getElementById("log_window_content").style.color = "red";

  document.getElementById("log_window").style.display = "flex";
  document.getElementById("log_window_content").innerText = arg.content;
  return;
}

function frontend_log_close() {
  document.getElementById("log_window").style.display = "none";
}

function console_show_response_result(arg) {
  console.log("Error: ", arg.error);
  console.log("Result: ", arg.result);
  console.log("Message: ", arg.message);
}

/* --------------------------------------------------------------------
                            Dataset helpers
-------------------------------------------------------------------- */

// /node/state uses PUT body: "enable" or "disable"
// GET returns: "leader" / "detached" / "disabled" etc.
const NODE_STATE_ENABLE  = "enable";
const NODE_STATE_DISABLE = "disable";

// --- Quiet refresh orchestration (debounced) ---
var g_quiet_refresh_timer = null;

function quiet_refresh_all(reason) {
  // reason is optional; useful for console debugging
  if (g_quiet_refresh_timer) clearTimeout(g_quiet_refresh_timer);

  // small delay helps during the "rejoining" window, avoids immediate false negatives
  g_quiet_refresh_timer = setTimeout(function() {
    console.log("[quiet_refresh_all]", reason || "");

    // 1) Properties (already quiet in your code)
    http_server_get_thread_network_properties();

    // 2) JSON active dataset -> populates form (quiet)
    http_server_fetch_active_dataset({ retries: 10, intervalMs: 1500, quiet: true });

    // 3) TLV dataset -> populates textarea (quiet)
    http_server_fetch_active_dataset_tlv({ retries: 10, intervalMs: 1500, quiet: true });

  }, 750);
}

// --- Missing helper used by Fetch Current Details ---
function extract_dataset_from_response(arg) {
  if (!arg) return null;

  // Wrapped form: { error, result, message }
  if (arg && typeof arg === "object" && arg.hasOwnProperty("result") && arg.result) {
    return arg.result;
  }

  // Direct dataset object
  if (arg && typeof arg === "object" && (arg.NetworkName || arg.MeshLocalPrefix || arg.PanId !== undefined)) {
    return arg;
  }

  return null;
}

// --- TLV normalizer/validator ---
function normalize_dataset_tlv(x) {
  if (x === null || x === undefined) return null;

  // If we got a JSON string (quoted), unquote it
  if (typeof x === "string") {
    let s = x.trim();

    if (s.startsWith('"') && s.endsWith('"')) {
      try { s = JSON.parse(s); } catch(e) { /* keep as-is */ }
      s = String(s).trim();
    }

    // Remove whitespace/newlines
    s = s.replace(/\s+/g, "").toLowerCase();

    // Must be even-length hex
    if (!s) return null;
    if (!/^[0-9a-f]+$/.test(s)) return null;
    if ((s.length % 2) !== 0) return null;

    return s;
  }

  return null;
}

function set_textarea_value_by_id(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function get_textarea_value_by_id(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function normalize_node_state(x) {
  if (x === null || x === undefined) return null;

  if (typeof x === "string") {
    return x.replace(/^"+|"+$/g, "").trim().toLowerCase();
  }
  if (x && x.hasOwnProperty("result")) return normalize_node_state(x.result);
  if (x && x.hasOwnProperty("message")) return normalize_node_state(x.message);
  return null;
}

function set_form_enabled(enabled) {
  // Form inputs
  const form = document.getElementById("network_form");
  if (form) {
    const els = form.querySelectorAll("input, button, select, textarea");
    els.forEach(e => {
      // don't disable the fetch button if present
      if (e.getAttribute("onclick") && e.getAttribute("onclick").includes("http_server_fetch_active_dataset")) {
        return;
      }
      // optionally don't disable reform button in the loop
      if (e.id === "btnFormNetwork") {
        return;
      }
      e.disabled = !enabled;
    });
  }

  // Explicit button IDs
  const btnForm = document.getElementById("btnFormNetwork");
  if (btnForm) btnForm.disabled = !enabled;

  const btnUpdate = document.getElementById("btnUpdateNetwork");
  if (btnUpdate) btnUpdate.disabled = !enabled;

  const btnAdd = document.getElementById("btnAddPrefix");
  if (btnAdd) btnAdd.disabled = !enabled;

  const btnDel = document.getElementById("btnDelPrefix");
  if (btnDel) btnDel.disabled = !enabled;
}

function padHex(n, width) {
  let s = n.toString(16);
  while (s.length < width) s = "0" + s;
  return s;
}

function set_input_value_by_name(formId, name, value) {
  const form = document.getElementById(formId);
  if (!form) return false;

  const el = form.querySelector(`[name="${CSS.escape(name)}"]`);
  if (!el) return false;

  el.value = value;
  return true;
}

function set_checkbox_by_name(name, checked) {
  const el = document.getElementsByName(name);
  if (el && el.length > 0) el[0].checked = !!checked;
}

function parse_panid_to_decimal(panIdStr) {
  if (panIdStr === undefined || panIdStr === null) return null;
  const s = String(panIdStr).trim();
  if (!s) return null;

  if (s.toLowerCase().startsWith("0x")) {
    const n = parseInt(s, 16);
    return Number.isFinite(n) ? n : null;
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function normalize_prefix_to_slash64(prefixStr) {
  if (prefixStr === undefined || prefixStr === null) return null;
  let s = String(prefixStr).trim();
  if (!s) return null;

  if (s.includes("/")) return s;
  return s + "/64";
}

function populate_form_from_active_dataset(ds) {
  if (!ds) return;

  if (ds.NetworkName) set_input_value_by_name("network_form", "networkName", ds.NetworkName);
  if (ds.NetworkKey) set_input_value_by_name("network_form", "networkKey", ds.NetworkKey);

  if (typeof ds.PanId === "number") {
    set_input_value_by_name("network_form", "panId", "0x" + padHex(ds.PanId, 4));
  }

  if (typeof ds.Channel === "number") set_input_value_by_name("network_form", "channel", ds.Channel);
  if (ds.ExtPanId) set_input_value_by_name("network_form", "extPanId", ds.ExtPanId);

  if (ds.MeshLocalPrefix) {
    const prefixOnly = String(ds.MeshLocalPrefix).split("/")[0];
    set_input_value_by_name("network_form", "prefix", prefixOnly);
  }
}

function get_form_values_scoped() {
  var root = $("#network_form").serializeJson();
  if (root.hasOwnProperty("channel") && root.channel !== "") {
    root.channel = parseInt(root.channel);
  }
  return root;
}

function build_patched_dataset(activeDs, formRoot) {
  var ds = JSON.parse(JSON.stringify(activeDs || {}));

  if (formRoot.networkName !== undefined && formRoot.networkName !== "")
    ds.NetworkName = String(formRoot.networkName);

  if (formRoot.networkKey !== undefined && formRoot.networkKey !== "")
    ds.NetworkKey = String(formRoot.networkKey);

  if (formRoot.extPanId !== undefined && formRoot.extPanId !== "")
    ds.ExtPanId = String(formRoot.extPanId);

  var panDec = parse_panid_to_decimal(formRoot.panId);
  if (panDec !== null) ds.PanId = panDec;

  if (formRoot.channel !== undefined && formRoot.channel !== "" && Number.isFinite(formRoot.channel))
    ds.Channel = parseInt(formRoot.channel);

  if (formRoot.prefix !== undefined && formRoot.prefix !== "") {
    ds.MeshLocalPrefix = normalize_prefix_to_slash64(formRoot.prefix);
  }

  return ds;
}

function http_server_get_node_state(cb_ok, cb_err) {
  $.ajax({
    url: '/node/state',
    type: 'GET',
    dataType: 'text',
    complete: function(xhr) {
      if (xhr.status >= 200 && xhr.status < 300) {
        let txt = (xhr.responseText || "").trim();
        let state = txt;

        if (txt.startsWith('"') && txt.endsWith('"')) {
          try { state = JSON.parse(txt); } catch (e) { /* keep as-is */ }
        }

        if (cb_ok) cb_ok(state, xhr);
      } else {
        if (cb_err) cb_err(xhr);
      }
    }
  });
}

function http_server_put_node_state(stateStr, cb_ok, cb_err) {
  $.ajax({
    url: '/node/state',
    type: 'PUT',
    contentType: 'application/json;charset=utf-8',
    dataType: 'text',
    data: JSON.stringify(String(stateStr)),
    complete: function(xhr) {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (cb_ok) cb_ok(xhr);
      } else {
        if (cb_err) cb_err(xhr);
      }
    }
  });
}

/* --------------------------------------------------------------------
                            Discover
-------------------------------------------------------------------- */
$(document).ready(function() {
  // Quiet refresh on load: properties + dataset + TLV
  quiet_refresh_all("page-load");

  // Disable Update (and other edits) until user explicitly fetches current dataset
  set_form_enabled(false);

  $("div ul li a").click(function() {
    $("div ul li a").removeClass("active");
    $(this).addClass("active");

    var tabx = $(this).attr('id');
    tabx = tabx.slice(5, 6);
    console.log(tabx);
    var panes = document.querySelectorAll(".tab-pane");
    for (i = 0; i < panes.length; i++) {
      panes[i].className = "tab-pane";
    }
    panes[tabx].className = "tab-pane active";
  });
});

function fill_thread_available_network_table(data) {
  document.getElementById("available_networks_body").innerHTML =
      "<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>";
  var rows = '';
  var row_id = 1;
  if (data.error)
    return;
  data.result.forEach(function(keys) {
    rows += '<tr>'
    for (var k in keys) {
      rows += '<td>' + keys[k] + '</td>'
    }
    rows += '<td>'
    rows +=
        "<button class=\"btn-submit\" onclick=\"frontend_show_join_network_window(this)\">Join<\/button>"
    rows += '</td>'
    rows += '</tr>'
    row_id++;
  });

  document.getElementById("available_networks_table").caption.innerText =
      "Available Thread Networks: Scan Completed"
  document.getElementById("available_networks_body").innerHTML = rows;
}

function http_server_scan_thread_network() {
  var log = {error : 0, content : ""};
  var title = "Available Network";

  document.getElementById("available_networks_table").caption.innerText =
      "Available Thread Networks: Waiting ..."

  log.content = "Waiting...";
  frontend_log_show(title, log);

  $.ajax({
    url : '/available_network',
    async : true,
    contentType : 'application/json;charset=utf-8',
    type : 'GET',
    dataType : "json",
    data : "",
    success : function(arg) {
      console_show_response_result(arg);
      fill_thread_available_network_table(arg);
      log.error = arg.error;
      log.content = arg.message;
      frontend_log_show(title, log);
    },
    error : function(arg) {
      log.error = "Error: ";
      log.content = "Unknown: ";
      frontend_log_show(title, log);
      console.log(arg);
    }
  })
}

/* --------------------------------------------------------------------
                            Join
-------------------------------------------------------------------- */
var g_available_networks_row;
function http_server_join_thread_network(root) {
  var log = {error : 0, content : ""};
  var title = "Join"
  $.ajax({
    url : '/join_network',
    async : true,
    contentType : 'application/json;charset=utf-8',
    type : 'POST',
    dataType : "json",
    data : JSON.stringify(root),
    success : function(arg) {
      console_show_response_result(arg);
      log.error = arg.error;
      log.content = arg.message;
      frontend_log_show(title, log);
    },
    error : function(arg) {
      log.error = "Error";
      log.content = "Unknown";
      frontend_log_show(title, log);
      console.log(arg)
    }
  })
}

function frontend_show_join_network_window(arg) {
  g_available_networks_row = $(arg).parent().parent().find("td");
  document.getElementById('join_window').style.display = 'block';
}

function frontend_submit_join_network(arg) {
  if (g_available_networks_row == "" || g_available_networks_row.eq(0) == "") {
    console.log("Invalid Network!");
    return;
  }
  var root = $("#join_network_table").serializeJson();
  root.index = parseInt(g_available_networks_row.eq(0).text());
  if (root.hasOwnProperty("defaultRoute") && root.defaultRoute == "on")
    root.defaultRoute = 1;
  else
    root.defaultRoute = 0;

  http_server_join_thread_network(root);
  document.getElementById('join_window').style.display = "none"
}

function frontend_cancel_join_network(data) {
  var item = document.getElementById('join_window');
  item.style.display = "none"
  return false;
}

function frontend_join_type_select(data) {
  if (data.options[data.selectedIndex].value == "network_key_type") {
    document.getElementById('join_network_key').style.display = 'block'
    document.getElementById('join_thread_pskd').style.display = 'none'
  } else if (data.options[data.selectedIndex].value == "thread_pskd_type") {
    document.getElementById('join_network_key').style.display = 'none'
    document.getElementById('join_thread_pskd').style.display = 'block'
  }
}

/* --------------------------------------------------------------------
                            Form
-------------------------------------------------------------------- */
function handle_form_response_message(arg, form_id) {
  item = document.getElementById(form_id);
  if (arg.hasOwnProperty("error") && !arg.error) {
    if (arg.result == "successful") {
      item.style.color = "green";
      item.innerHTML = arg.message;
    } else {
      item.style.color = "red";
      item.innerHTML = arg.message;
    }
  } else {
    item.style.color = "red";
    item.innerHTML = "Try against.";
  }
}

/* convert form's input to json type */
$.fn.serializeJson =
    function() {
  var serializeObj = {};
  var array = this.serializeArray();
  var str = this.serialize();
  $(array).each(function() {
    if (serializeObj[this.name]) {
      if ($.isArray(serializeObj[this.name])) {
        serializeObj[this.name].push(this.value);
      } else {
        serializeObj[this.name] = [ serializeObj[this.name], this.value ];
      }
    } else {
      serializeObj[this.name] = this.value;
    }
  });
  return serializeObj;
}

function http_server_upload_form_network_table() {
  item = document.getElementById("form_tip");
  item.style.color = "green";
  item.style.display = 'block';

  var root = $("#network_form").serializeJson();
  var title = "Form";
  if (root.hasOwnProperty("defaultRoute") && root.defaultRoute == "on")
    root.defaultRoute = 1;
  else
    root.defaultRoute = 0;
  if (root.hasOwnProperty("defaultRoute") && root.defaultRoute != "")
    root.channel = parseInt(root.channel);

  var log = {error : 0, content : ""};

  $.ajax({
    url : '/form_network',
    async : true,
    contentType : 'application/json;charset=utf-8',
    type : 'POST',
    dataType : "json",
    data : JSON.stringify(root),
    success : function(arg) {
      console_show_response_result(arg);
      if (arg != {})
        handle_form_response_message(arg, "form_tip");
      log.error = arg.error;
      log.content = arg.message;
      frontend_log_show(title, log);

      // After re-form completes, refresh everything quietly
      quiet_refresh_all("after-reform-network");
    },
    error : function(arg) {
      log.error = "Error: ";
      log.content = "Unknown: ";
      frontend_log_show(title, log);
      console.log(arg)
    }
  })
}

/* --------------------------------------------------------------------
                            Status
-------------------------------------------------------------------- */
function decode_thread_status_package(package) {
  if (package.error)
    return;

  document.getElementById("ipv6-link_local_address").innerHTML =
      package.result["IPv6:LinkLocalAddress"];
  document.getElementById("ipv6-routing_local_address").innerHTML =
      package.result["IPv6:RoutingLocalAddress"];
  document.getElementById("ipv6-mesh_local_address").innerHTML =
      package.result["IPv6:MeshLocalAddress"];
  document.getElementById("ipv6-mesh_local_prefix").innerHTML =
      package.result["IPv6:MeshLocalPrefix"];

  document.getElementById("network-name").innerHTML =
      package.result["Network:Name"];
  document.getElementById("network-panid").innerHTML =
      package.result["Network:PANID"];
  document.getElementById("network-partition_id").innerHTML =
      package.result["Network:PartitionID"];
  document.getElementById("network-xpanid").innerHTML =
      package.result["Network:XPANID"];
  document.getElementById("network-baid").innerHTML =
      package.result["Network:BorderAgentID"];

  document.getElementById("openthread-version").innerHTML =
      package.result["OpenThread:Version"];
  document.getElementById("openthread-version_api").innerHTML =
      package.result["OpenThread:Version API"];
  document.getElementById("openthread-role").innerHTML =
      package.result["RCP:State"];
  document.getElementById("openthread-PSKc").innerHTML =
      package.result["OpenThread:PSKc"];

  document.getElementById("rcp-channel").innerHTML =
      package.result["RCP:Channel"];
  document.getElementById("rcp-EUI64").innerHTML = package.result["RCP:EUI64"];
  document.getElementById("rcp-txpower").innerHTML =
      package.result["RCP:TxPower"];
  document.getElementById("rcp-version").innerHTML =
      package.result["RCP:Version"];

  document.getElementById("WPAN-service").innerHTML =
      package.result["WPAN service"];

  document.getElementById("t-ipv6-link_local_address").innerHTML =
      package.result["IPv6:LinkLocalAddress"];
  document.getElementById("t-ipv6-routing_local_address").innerHTML =
      package.result["IPv6:RoutingLocalAddress"];
  document.getElementById("t-ipv6-mesh_local_address").innerHTML =
      package.result["IPv6:MeshLocalAddress"];
  document.getElementById("t-ipv6-mesh_local_prefix").innerHTML =
      package.result["IPv6:MeshLocalPrefix"];

  document.getElementById("t-network-name").innerHTML =
      package.result["Network:Name"];
  document.getElementById("t-network-panid").innerHTML =
      package.result["Network:PANID"];
  document.getElementById("t-network-partition_id").innerHTML =
      package.result["Network:PartitionID"];
  document.getElementById("t-network-xpanid").innerHTML =
      package.result["Network:XPANID"];
  document.getElementById("t-network-baid").innerHTML =
      package.result["Network:BorderAgentID"];

  document.getElementById("t-openthread-version").innerHTML =
      package.result["OpenThread:Version"];
  document.getElementById("t-openthread-version_api").innerHTML =
      package.result["OpenThread:Version API"];
  document.getElementById("t-openthread-role").innerHTML =
      package.result["RCP:State"];
  document.getElementById("t-openthread-PSKc").innerHTML =
      package.result["OpenThread:PSKc"];

  document.getElementById("t-rcp-channel").innerHTML =
      package.result["RCP:Channel"];
  document.getElementById("t-rcp-EUI64").innerHTML = package.result["RCP:EUI64"]
  document.getElementById("t-rcp-txpower").innerHTML =
      package.result["RCP:TxPower"];
  document.getElementById("t-rcp-version").innerHTML =
      package.result["RCP:Version"];

  document.getElementById("t-WPAN-service").innerHTML =
      package.result["WPAN service"];
}

function http_server_get_thread_network_properties() {
  var log = {error : 0, content : ""};
  var title = "Properties";
  $.ajax({
    url : '/get_properties',
    async : true,
    contentType : 'application/json;charset=utf-8',
    type : 'GET',
    dataType : "json",
    data : "",
    success : function(arg) {
      console_show_response_result(arg);
      decode_thread_status_package(arg);
      log.error = arg.error;
      log.content = arg.message;
      //frontend_log_show(title, log);
    },
    error : function(arg) {
      log.error = "Error: ";
      log.content = "Unknown: ";
      frontend_log_show(title, log);
      console.log(arg)
    }
  })
}

function sleep_ms(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function http_server_fetch_active_dataset(opts) {
  opts = opts || {};
  var retries = (opts.retries !== undefined) ? opts.retries : 6;
  var intervalMs = (opts.intervalMs !== undefined) ? opts.intervalMs : 1500;
  var quiet = (opts.quiet !== undefined) ? opts.quiet : false;

  var title = "Active Dataset";
  var log = {error : 0, content : ""};
  var hint = document.getElementById("dataset_hint");

  if (hint) hint.innerText = "Fetching active dataset...";

  function try_once(attempt) {
    $.ajax({
      url : '/node/dataset/active',
      async : true,
      contentType : 'application/json;charset=utf-8',
      type : 'GET',
      dataType : "json",
      data : "",
      success : function(arg) {
        var ds = extract_dataset_from_response(arg);
        if (!ds) {
          return handle_retry(attempt, "Got response but no dataset payload");
        }

        populate_form_from_active_dataset(ds);
        set_form_enabled(true);

        if (hint) hint.innerText = "Loaded current dataset. You can now edit safely.";

        if (!quiet) {
          log.error = 0;
          log.content = "Loaded active dataset";
          // optional: frontend_log_show(title, log);
        }
      },
      error : function(err) {
        handle_retry(attempt, err);
      }
    });
  }

  function handle_retry(attempt, err) {
    if (attempt >= retries) {
      if (hint) hint.innerText = "Failed to fetch dataset. Thread may still be restarting. Try again shortly.";

      log.error = 1;
      log.content = "Failed to fetch active dataset";
      frontend_log_show(title, log);
      console.log("fetch_active_dataset failed:", err);
      return;
    }

    if (hint) hint.innerText = "Thread is rejoining… retrying (" + (attempt + 1) + "/" + retries + ")";

    http_server_get_node_state(function(stateStr) {
      var st = normalize_node_state(stateStr);

      if (hint) {
        if (!st) {
          hint.innerText = "Thread status unknown… retrying (" + (attempt + 1) + "/" + retries + ")";
        } else if (st === "disabled") {
          hint.innerText = "Thread is disabled/restarting… retrying (" + (attempt + 1) + "/" + retries + ")";
        } else {
          hint.innerText = "Thread state: " + st + "… dataset not ready yet, retrying (" + (attempt + 1) + "/" + retries + ")";
        }
      }

      sleep_ms(intervalMs).then(function() { try_once(attempt + 1); });

    }, function(_errState) {
      sleep_ms(intervalMs).then(function() { try_once(attempt + 1); });
    });
  }

  try_once(0);
}

function http_server_fetch_active_dataset_tlv(opts) {
  opts = opts || {};
  var retries    = (opts.retries    !== undefined) ? opts.retries    : 6;
  var intervalMs = (opts.intervalMs !== undefined) ? opts.intervalMs : 1500;
  var quiet      = (opts.quiet      !== undefined) ? opts.quiet      : false;

  var title = "Active Dataset TLV";
  var log = {error: 0, content: ""};

  var tip = document.getElementById("tlv_tip");
  var hint = document.getElementById("dataset_hint");

  function setTip(msg, ok) {
    if (tip) {
      tip.style.display = "block";
      tip.style.color = ok ? "green" : "#b02a37";
      tip.innerText = msg;
    } else if (hint) {
      hint.innerText = msg;
    }
  }

  setTip("Fetching active dataset TLV...", true);

  function try_once(attempt) {
    $.ajax({
      url: '/node/dataset/active',
      type: 'GET',
      dataType: 'text',
      headers: { 'Accept': 'text/plain' },
      success: function(respText) {
        var tlv = normalize_dataset_tlv(respText);
        if (!tlv) return handle_retry(attempt, "Invalid/empty TLV payload");

        set_textarea_value_by_id("activeDatasetTlv", tlv);

        setTip("TLV loaded.", true);

        if (!quiet) {
          log.error = 0;
          log.content = "Loaded active dataset TLV";
          // optional popup:
          // frontend_log_show(title, log);
        }
      },
      error: function(err) {
        handle_retry(attempt, err);
      }
    });
  }

  function handle_retry(attempt, err) {
    if (attempt >= retries) {
      setTip("Failed to fetch TLV (Thread may be rejoining). Try again shortly.", false);
      log.error = 1;
      log.content = "Failed to fetch active dataset TLV";
      if (!quiet) frontend_log_show(title, log);
      console.log("fetch_active_dataset_tlv failed:", err);
      return;
    }

    http_server_get_node_state(function(stateStr) {
      var st = normalize_node_state(stateStr) || "unknown";
      setTip("Thread state: " + st + "… retrying (" + (attempt + 1) + "/" + retries + ")", true);
      sleep_ms(intervalMs).then(function(){ try_once(attempt + 1); });
    }, function() {
      setTip("Retrying (" + (attempt + 1) + "/" + retries + ")", true);
      sleep_ms(intervalMs).then(function(){ try_once(attempt + 1); });
    });
  }

  try_once(0);
}

/*
 * UPDATE ACTIVE DATASET (in-place)
 */

async function wait_for_node_state_not_disabled(timeoutMs = 30000, intervalMs = 1000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const state = await new Promise((resolve, reject) => {
      http_server_get_node_state(
        (s) => resolve(normalize_node_state(s)),
        (xhr) => reject(xhr)
      );
    });

    if (state && state !== "disabled") return state;

    await sleep_ms(intervalMs);
  }

  return null;
}

function http_server_update_active_dataset() {
  var title = "Update Active Dataset";
  var log = {error : 0, content : ""};
  var hint = document.getElementById("dataset_hint");
  if (hint) hint.innerText = "Updating active dataset...";

  var formRoot = get_form_values_scoped();

  $.ajax({
    url : '/node/dataset/active',
    async : true,
    contentType : 'application/json;charset=utf-8',
    type : 'GET',
    dataType : "json",
    data : "",
    success : function(argDs) {
      var activeDs = argDs;
      if (argDs && argDs.hasOwnProperty("result")) activeDs = argDs.result;

      var updatedDs = build_patched_dataset(activeDs, formRoot);

      http_server_get_node_state(function(stateStr) {
        var curState = normalize_node_state(stateStr);
        if (!curState) curState = "unknown";

        var mustDisable = (curState !== "disabled");

        async function finish_success() {
          if (hint) hint.innerText = "Dataset updated. Waiting for Thread to come back...";

          const state = await wait_for_node_state_not_disabled(45000, 1500);

          if (!state) {
            if (hint) hint.innerText = "Dataset updated, but Thread is still restarting. Try refresh in a moment.";
            log.error = 0;
            log.content = "Dataset updated (Thread still restarting)";
            frontend_log_show(title, log);
            return;
          }

          if (hint) hint.innerText = "Thread is back (" + state + "). Refreshing details...";

          // One call does Properties + Dataset + TLV
          quiet_refresh_all("after-update-dataset");

          log.error = 0;
          log.content = "Active dataset updated";
          frontend_log_show(title, log);
        }

        function put_dataset_then_maybe_enable() {
          $.ajax({
            url : '/node/dataset/active',
            async : true,
            contentType : 'application/json;charset=utf-8',
            type : 'PUT',
            dataType : "text",
            data : JSON.stringify(updatedDs),

            complete: function(xhr) {
              const ok = (xhr.status >= 200 && xhr.status < 300);

              if (!ok) {
                if (hint) hint.innerText = "Failed to PUT active dataset.";
                log.error = 1;
                log.content = "Failed to update active dataset";
                frontend_log_show(title, log);
                console.log("PUT /node/dataset/active failed:", xhr.status, xhr.responseText);

                if (mustDisable) {
                  http_server_put_node_state(NODE_STATE_ENABLE, function(){}, function(){});
                }
                return;
              }

              if (mustDisable) {
                if (hint) hint.innerText = "Dataset applied. Re-enabling Thread (may take a while)...";

                http_server_put_node_state(
                  NODE_STATE_ENABLE,
                  function(_ok) { finish_success(); },
                  function(errEnable) {
                    console.log("Enable request error (non-fatal):", errEnable);
                    if (hint) hint.innerText = "Dataset updated. Thread is rejoining (enable response not confirmed)...";
                    finish_success();
                  }
                );
              } else {
                finish_success();
              }
            }
          });
        }

        if (mustDisable) {
          if (hint) hint.innerText = "Disabling Thread to apply dataset...";

          http_server_put_node_state(
            NODE_STATE_DISABLE,
            function(_ok) { put_dataset_then_maybe_enable(); },
            function(errDisable) {
              if (hint) hint.innerText = "Failed to disable Thread (required to update active dataset).";
              log.error = 1;
              log.content = "Failed to disable Thread";
              frontend_log_show(title, log);
              console.log(errDisable);
            }
          );
        } else {
          put_dataset_then_maybe_enable();
        }

      }, function(errState) {
        if (hint) hint.innerText = "Failed to read node state.";
        log.error = 1;
        log.content = "Failed to read node state";
        frontend_log_show(title, log);
        console.log(errState);
      });

    },
    error : function(errDs) {
      if (hint) hint.innerText = "Failed to fetch active dataset.";
      log.error = 1;
      log.content = "Failed to fetch active dataset";
      frontend_log_show(title, log);
      console.log(errDs);
    }
  });
}

function http_server_update_active_dataset_tlv() {
  var title = "Update Active Dataset TLV";
  var log = { error: 0, content: "" };

  var tlvTip = document.getElementById("tlv_tip");
  var hint = tlvTip || document.getElementById("dataset_hint");

  var raw = (document.getElementById("activeDatasetTlv") || {}).value || "";
  var tlv = normalize_dataset_tlv(raw);

  if (!tlv) {
    log.error = 1;
    log.content = "Invalid TLV";
    frontend_log_show(title, log);
    if (hint) {
      hint.style.display = "block";
      hint.style.color = "red";
      hint.innerText = "Invalid TLV (must be hex, even length).";
    }
    return;
  }

  if (hint) {
    hint.style.display = "block";
    hint.style.color = "green";
    hint.innerText = "Updating TLV…";
  }

  http_server_get_node_state(function(stateStr) {
    var curState = normalize_node_state(stateStr) || "unknown";
    var mustDisable = (curState !== "disabled");

    function put_tlv_then_maybe_enable() {

      function finish_ok_flow() {
        async function finish_success() {
          if (hint) hint.innerText = "TLV applied. Waiting for Thread to come back...";

          const state = await wait_for_node_state_not_disabled(45000, 1500);

          if (!state) {
            if (hint) hint.innerText = "TLV applied, but Thread is still restarting. Refresh in a moment.";
            log.error = 0;
            log.content = "TLV updated (Thread still restarting)";
            frontend_log_show(title, log);
            return;
          }

          if (hint) hint.innerText = "Thread is back (" + state + "). Refreshing details...";

          // One call does Properties + Dataset + TLV
          quiet_refresh_all("after-update-tlv");

          log.error = 0;
          log.content = "TLV updated";
          frontend_log_show(title, log);
        }

        if (mustDisable) {
          if (hint) hint.innerText = "TLV applied. Re-enabling Thread (may take a while)...";

          http_server_put_node_state(
            NODE_STATE_ENABLE,
            function() { finish_success(); },
            function(errEnable) {
              console.log("Enable request error (non-fatal):", errEnable);
              if (hint) hint.innerText = "TLV updated. Thread is rejoining (enable response not confirmed)...";
              finish_success();
            }
          );
        } else {
          finish_success();
        }
      }

      $.ajax({
        url: '/node/dataset/active',
        type: 'PUT',
        dataType: 'text',
        contentType: 'text/plain',
        processData: false,
        data: tlv,
        beforeSend: function(xhr) {
          xhr.setRequestHeader("Accept", "text/plain");
          xhr.setRequestHeader("Content-Type", "text/plain");
        },
        complete: function(xhr) {
          var ok = (xhr.status >= 200 && xhr.status < 300);
          if (ok) {
            finish_ok_flow();
            return;
          }

          console.log("PUT TLV failed:", xhr.status, xhr.responseText);

          if (xhr.status === 400) {
            $.ajax({
              url: '/node/dataset/active',
              type: 'PUT',
              dataType: 'text',
              contentType: 'application/json;charset=utf-8',
              processData: false,
              data: JSON.stringify(tlv),
              beforeSend: function(x2) {
                x2.setRequestHeader("Accept", "text/plain");
              },
              complete: function(x2) {
                var ok2 = (x2.status >= 200 && x2.status < 300);
                if (ok2) {
                  finish_ok_flow();
                  return;
                }

                var code2 = (x2 && x2.status) ? x2.status : "?";
                if (hint) {
                  hint.style.display = "block";
                  hint.style.color = "red";
                  hint.innerText = "Failed to PUT TLV (HTTP " + code2 + ")";
                }
                log.error = 1;
                log.content = "Failed to PUT TLV (HTTP " + code2 + ")";
                frontend_log_show(title, log);
                console.log("PUT TLV fallback failed:", x2.status, x2.responseText);

                if (mustDisable) {
                  http_server_put_node_state(NODE_STATE_ENABLE, function(){}, function(){});
                }
              }
            });

            return;
          }

          var code = (xhr && xhr.status) ? xhr.status : "?";
          if (hint) {
            hint.style.display = "block";
            hint.style.color = "red";
            hint.innerText = "Failed to PUT TLV (HTTP " + code + ")";
          }
          log.error = 1;
          log.content = "Failed to PUT TLV (HTTP " + code + ")";
          frontend_log_show(title, log);

          if (mustDisable) {
            http_server_put_node_state(NODE_STATE_ENABLE, function(){}, function(){});
          }
        }
      });
    }

    if (mustDisable) {
      if (hint) hint.innerText = "Disabling Thread to apply TLV...";
      http_server_put_node_state(
        NODE_STATE_DISABLE,
        function() { put_tlv_then_maybe_enable(); },
        function(errDisable) {
          if (hint) {
            hint.style.display = "block";
            hint.style.color = "red";
            hint.innerText = "Failed to disable Thread (required before TLV update).";
          }
          log.error = 1;
          log.content = "Failed to disable Thread";
          frontend_log_show(title, log);
          console.log(errDisable);
        }
      );
    } else {
      put_tlv_then_maybe_enable();
    }

  }, function(errState) {
    if (hint) {
      hint.style.display = "block";
      hint.style.color = "red";
      hint.innerText = "Failed to read node state.";
    }
    log.error = 1;
    log.content = "Failed to read node state";
    frontend_log_show(title, log);
    console.log(errState);
  });
}

/* --------------------------------------------------------------------
                            Setting
-------------------------------------------------------------------- */
function http_server_add_prefix_to_thread_network() {
  var root = $("#network_setting").serializeJson();
  var log = {error : 0, content : ""};
  var title = "Add Prefix";
  if (root.hasOwnProperty("defaultRoute") && root.defaultRoute == "on")
    root.defaultRoute = 1;
  else
    root.defaultRoute = 0;

  $.ajax({
    url : '/add_prefix',
    async : true,
    contentType : 'application/json;charset=utf-8',
    type : 'POST',
    dataType : "json",
    data : JSON.stringify(root),
    success : function(arg) {
      console_show_response_result(arg);
      log.error = arg.error;
      log.content = arg.message;
      frontend_log_show(title, log);
    },
    error : function(arg) {
      log.error = "Error: ";
      log.content = "Unknown: ";
      frontend_log_show(title, log);
      console.log(arg)
    }
  })
}

function http_server_delete_prefix_from_thread_network() {
  var root = $("#network_setting").serializeJson();
  var log = {error : 0, content : ""};
  var title = "Delete Prefix";
  $.ajax({
    url : '/delete_prefix',
    async : true,
    contentType : 'application/json;charset=utf-8',
    type : 'POST',
    dataType : "json",
    data : JSON.stringify(root),
    success : function(arg) {
      console_show_response_result(arg);
      log.error = arg.error;
      log.content = arg.message;
      frontend_log_show(title, log);
    },
    error : function(arg) {
      log.error = "Error: ";
      log.content = "Unknown: ";
      frontend_log_show(title, log);
      console.log(arg)
    }
  })
}

/* --------------------------------------------------------------------
                            commission
-------------------------------------------------------------------- */
function http_server_thread_network_commissioner() {
  var root = {
    pskd : "1234567890",
  };

  $.ajax({
    url : '/commission',
    async : true,
    contentType : 'application/json;charset=utf-8',
    type : 'POST',
    dataType : "json",
    data : JSON.stringify(root),
    success : function(arg) { console_show_response_result(arg); },
    error : function(arg) { console.log(arg) }
  })
}

/* --------------------------------------------------------------------
                            Topology
-------------------------------------------------------------------- */
function ctrl_thread_network_topology(arg) {
  var node_info = undefined;
  var topology_info = undefined;
  if (arg == "Running" || arg == "Suspend") {

    $.ajax({
      url : '/node_information',
      async : true,
      contentType : 'application/json;charset=utf-8',
      type : 'GET',
      dataType : "json",
      data : "",
      success : function(msg) {
        console_show_response_result(msg);
        node_info = msg;
        if (node_info != undefined && topology_info != undefined) {
          handle_thread_networks_topology_package(node_info, topology_info);
        }
      },
      error : function(msg) { console.log(msg) }
    })
    $.ajax({
      url : '/topology',
      async : true,
      contentType : 'application/json;charset=utf-8',
      type : 'GET',
      dataType : "json",
      data : "",
      success : function(msg) {
        console_show_response_result(msg);
        topology_info = msg;
        if (node_info != undefined && topology_info != undefined) {
          handle_thread_networks_topology_package(node_info, topology_info);
        }
      },
      error : function(msg) { console.log(msg) }
    })
  }
}

function http_server_build_thread_network_topology(arg) {
  ctrl_thread_network_topology("Running");
  document.getElementById("btn_topology").innerHTML = "Reload Topology";
}

function intToHexString(num, len) {
  var value;
  value = num.toString(16);

  while (value.length < len) {
    value = '0' + value;
  }
  return value;
} class Topology_Graph {
  constructor() {
    this.graph_isReady = false;
    this.graph_info = {'nodes' : [], 'links' : []};
    this.node_detialInfo = 'Unknown';
    this.router_number = 0;
    this.detailList = {
      'ExtAddress' : {'title' : false, 'content' : true},
      'Rloc16' : {'title' : false, 'content' : true},
      'Mode' : {'title' : false, 'content' : false},
      'Connectivity' : {'title' : false, 'content' : false},
      'Route' : {'title' : false, 'content' : false},
      'LeaderData' : {'title' : false, 'content' : false},
      'NetworkData' : {'title' : false, 'content' : true},
      'IP6Address List' : {'title' : false, 'content' : true},
      'MACCounters' : {'title' : false, 'content' : false},
      'ChildTable' : {'title' : false, 'content' : false},
      'ChannelPages' : {'title' : false, 'content' : false}
    };
  }
  update_detail_list() {
    for (var detailInfoKey in this.detailList) {
      this.detailList[detailInfoKey]['title'] = false;
    }
    for (var diagInfoKey in this.nodeDetailInfo) {
      if (diagInfoKey in this.detailList) {
        this.detailList[diagInfoKey]['title'] = true;
      }
    }
  }
}

var topology_update = new Topology_Graph();
function handle_thread_networks_topology_package(node, diag) {
  var nodeMap = {};
  var count, src, dist, rloc, child, rlocOfParent, rlocOfChild, diagOfNode,
      linkNode, childInfo;
  let topology = new Topology_Graph();

  var diag_package = diag["result"];
  for (diagOfNode of diag_package) {

    diagOfNode['RouteId'] =
        '0x' + intToHexString(diagOfNode['Rloc16'] >> 10, 2);
    diagOfNode['Rloc16'] = '0x' + intToHexString(diagOfNode['Rloc16'], 4);

    diagOfNode['LeaderData']['LeaderRouterId'] =
        '0x' + intToHexString(diagOfNode['LeaderData']['LeaderRouterId'], 2);
    for (linkNode of diagOfNode['Route']['RouteData']) {
      linkNode['RouteId'] = '0x' + intToHexString(linkNode['RouteId'], 2);
    }
  }

  count = 0;
  var node_info = node["result"];
  for (diagOfNode of diag_package) {
    if ('ChildTable' in diagOfNode) {

      rloc = parseInt(diagOfNode['Rloc16'], 16).toString(16);
      nodeMap[rloc] = count;

      if (diagOfNode['RouteId'] == diagOfNode['LeaderData']['LeaderRouterId']) {
        diagOfNode['Role'] = 'Leader';
      } else {
        diagOfNode['Role'] = 'Router';
      }

      topology.graph_info.nodes.push(diagOfNode);

      if (diagOfNode['Rloc16'] === node_info['Rloc16']) {
        topology.node_detialInfo = diagOfNode
      }
      count = count + 1;
    }
  }
  topology.router_number = count;
  document.getElementById("topology_netwotkname").innerHTML =
      node_info["NetworkName"];
  document.getElementById("topology_leader").innerHTML =
      "0x" + node_info["LeaderData"]["LeaderRouterId"].toString(16);
  document.getElementById("topology_router_number").innerHTML =
      count.toString();

  src = 0;
  for (diagOfNode of diag_package) {
    if ('ChildTable' in diagOfNode) {
      for (linkNode of diagOfNode['Route']['RouteData']) {
        rloc = (parseInt(linkNode['RouteId'], 16) << 10)
                   .toString(16);
        if (rloc in nodeMap) {
          dist = nodeMap[rloc];
          if (src < dist) {
            topology.graph_info.links.push({
              'source' : src,
              'target' : dist,
              'weight' : 1,
              'type' : 0,
              'linkInfo' : {
                'inQuality' : linkNode['LinkQualityIn'],
                'outQuality' : linkNode['LinkQualityOut']
              }
            });
          }
        }
      }

      for (childInfo of diagOfNode['ChildTable']) {
        child = {};
        rlocOfParent = parseInt(diagOfNode['Rloc16'], 16).toString(16);
        rlocOfChild =
            (parseInt(diagOfNode['Rloc16'], 16) + childInfo['ChildId'])
                .toString(16);

        src = nodeMap[rlocOfParent];

        child['Rloc16'] = '0x' + rlocOfChild;
        child['RouteId'] = diagOfNode['RouteId'];
        nodeMap[rlocOfChild] = count;
        child['Role'] = 'Child';
        topology.graph_info.nodes.push(child);
        topology.graph_info.links.push({
          'source' : src,
          'target' : count,
          'weight' : 1,
          'type' : 1,
          'linkInfo' :
              {'Timeout' : childInfo['Timeout'], 'Mode' : childInfo['Mode']}

        });
        count = count + 1;
      }
    }
    src = src + 1;
  }

  draw_thread_topology_graph(topology);
}

var svg = d3.select('.d3graph')
              .append("svg")
              .attr('preserveAspectRatio', 'xMidYMid meet');

var force = d3.layout.force();

var link;
var node;

var trigger_flag = true;
function draw_thread_topology_graph(arg) {
  var json, tooltip;
  var scale, len;
  var topology = new Topology_Graph();
  topology = arg;
  d3.selectAll("svg > *").remove();
  scale = topology.graph_info.nodes.length;
  if (scale > 8) {
    scale = 8;
  }
  len = 150 * Math.sqrt(scale);

  // Topology graph
  svg.attr('viewBox',
           '0, 0, ' + len.toString(10) + ', ' + (len / (3 / 2)).toString(10));

  // Legend
  svg.append('circle')
      .attr('cx', len - 20)
      .attr('cy', 10)
      .attr('r', 3)
      .style('fill', "#7e77f8")
      .style('stroke', '#484e46')
      .style('stroke-width', '0.4px');

  svg.append('circle')
      .attr("cx", len - 20)
      .attr('cy', 20)
      .attr('r', 3)
      .style('fill', '#03e2dd')
      .style('stroke', '#484e46')
      .style('stroke-width', '0.4px');

  svg.append('circle')
      .attr('cx', len - 20)
      .attr('cy', 30)
      .attr('r', 3)
      .style('fill', '#aad4b0')
      .style('stroke', '#484e46')
      .style('stroke-width', '0.4px')
      .style('stroke-dasharray', '2 1');

  svg.append('circle')
      .attr('cx', len - 50)
      .attr('cy', 10)
      .attr('r', 3)
      .style('fill', '#ffffff')
      .style('stroke', '#f39191')
      .style('stroke-width', '0.4px');

  svg.append('text')
      .attr('x', len - 15)
      .attr('y', 10)
      .text('Leader')
      .style('font-size', '4px')
      .attr('alignment-baseline', 'middle');

  svg.append('text')
      .attr('x', len - 15)
      .attr('y', 20)
      .text('Router')
      .style('font-size', '4px')
      .attr('alignment-baseline', 'middle');

  svg.append('text')
      .attr('x', len - 15)
      .attr('y', 30)
      .text('Child')
      .style('font-size', '4px')
      .attr('alignment-baseline', 'middle');

  svg.append('text')
      .attr('x', len - 45)
      .attr('y', 10)
      .text('Selected')
      .style('font-size', '4px')
      .attr('alignment-baseline', 'middle');

  // Tooltip style  for each node
  tooltip = d3.select('body')
                .append('div')
                .attr('data-toggle', 'tooltip')
                .style('position', 'absolute')
                .style('z-index', '10')
                .style('font-size', '17px')
                .style('color', '#000000')
                .style('display', 'block')
                .text('a simple tooltip');

  json = topology.graph_info;

  force.distance(40)
      .size([ len, len / (3 / 2) ])
      .nodes(json.nodes)
      .links(json.links)
      .start();

  link = svg.selectAll('.link')
             .data(json.links)
             .enter()
             .append('line')
             .attr('class', 'link')
             .style('stroke', '#908484')
             // Dash line for link between child and parent
             .style('stroke-dasharray',
                    function(item) {
                      if ('Timeout' in item.linkInfo)
                        return '4 4';
                      else
                        return '0 0'
                    })
             // Line width representing link quality
             .style('stroke-width',
                    function(item) {
                      if ('inQuality' in item.linkInfo)
                        return Math.sqrt(item.linkInfo.inQuality / 2);
                      else
                        return Math.sqrt(0.5)
                    })
             // Effect of mouseover on a line
             .on('mouseover',
                 function(item) {
                   return tooltip.style('visibility', 'visible')
                       .text(item.linkInfo);
                 })
             .on('mousemove',
                 function() {
                   return tooltip.style('top', (d3.event.pageY - 10) + 'px')
                       .style('left', (d3.event.pageX + 10) + 'px');
                 })
             .on('mouseout',
                 function() { return tooltip.style('display', 'none'); });

  node = svg.selectAll('.node')
             .data(json.nodes)
             .enter()
             .append('g')
             .attr('class', function(item) { return item.Role; })
             .call(force.drag)
             // Tooltip effect of mouseover on a node
             .on('mouseover',
                 function(item) {
                   return tooltip.style('display', 'block').text(item.Rloc16);
                 })
             .on('mousemove',
                 function() {
                   return tooltip.style('top', (d3.event.pageY - 10) + 'px')
                       .style('left', (d3.event.pageX + 10) + 'px');
                 })
             .on('mouseout',
                 function() { return tooltip.style('display', 'none'); });

  d3.selectAll('.Child')
      .append('circle')
      .attr('r', '6')
      .attr('fill', '#aad4b0')
      .style('stroke', '#484e46')
      .style('stroke-dasharray', '2 1')
      .style('stroke-width', '0.5px')
      .attr('class', function(item) { return item.Rloc16; })
      .on('mouseover',
          function(item) {
            return tooltip.style('display', 'block').text(item.Rloc16);
          })
      .on('mousemove',
          function() {
            return tooltip.style('top', (d3.event.pageY - 10) + 'px')
                .style('left', (d3.event.pageX + 10) + 'px');
          })
      .on('mouseout', function() { return tooltip.style('display', 'none'); });

  d3.selectAll('.Leader')
      .append('circle')
      .attr('r', '8')
      .attr('fill', '#7e77f8')
      .style('stroke', '#484e46')
      .style('stroke-width', '1px')
      .attr('class', function(item) { return 'Stroke'; })
      // Effect that node will become bigger when mouseover
      .on('mouseover',
          function(item) {
            d3.select(this).transition().attr('r', '9');
            return tooltip.style('display', 'block').text(item.Rloc16);
          })
      .on('mousemove',
          function() {
            return tooltip.style('top', (d3.event.pageY - 10) + 'px')
                .style('left', (d3.event.pageX + 10) + 'px');
          })
      .on('mouseout',
          function() {
            d3.select(this).transition().attr('r', '8');
            return tooltip.style('display', 'none');
          })
      // Effect that node will have a yellow edge when clicked
      .on('click', function(item) {
        d3.selectAll('.Stroke')
            .style('stroke', '#484e46')
            .style('stroke-width', '1px');
        d3.select(this).style('stroke', '#f39191').style('stroke-width', '1px');
        topology.nodeDetailInfo = item;
        topology.update_detail_list();
      });

  d3.selectAll('.Router')
      .append('circle')
      .attr('r', '8')
      .style('stroke', '#484e46')
      .style('stroke-width', '1px')
      .attr('fill', '#03e2dd')
      .attr('class', 'Stroke')
      .on('mouseover',
          function(item) {
            d3.select(this).transition().attr('r', '8');
            return tooltip.style('display', 'block').text(item.Rloc16);
          })
      .on('mousemove',
          function() {
            return tooltip.style('top', (d3.event.pageY - 10) + 'px')
                .style('left', (d3.event.pageX + 10) + 'px');
          })
      .on('mouseout',
          function() {
            d3.select(this).transition().attr('r', '7');
            return tooltip.style('display', 'none');
          })
      // The same effect as Leader
      .on('click', function(item) {
        d3.selectAll('.Stroke')
            .style('stroke', '#484e46')
            .style('stroke-width', '1px');
        d3.select(this).style('stroke', '#f39191').style('stroke-width', '1px');
        topology.nodeDetailInfo = item;
        topology.update_detail_list();
      });

  if (trigger_flag) {
    force.on('tick', function() {
      link.attr('x1', function(item) { return item.source.x; })
          .attr('y1', function(item) { return item.source.y; })
          .attr('x2', function(item) { return item.target.x; })
          .attr('y2', function(item) { return item.target.y; });
      node.attr(
          'transform',
          function(
              item) { return 'translate(' + item.x + ',' + item.y + ')'; });
    });
    trigger_flag = true;
  } else {
    force.on('end', function() {
      link.attr('x1', function(item) { return item.source.x; })
          .attr('y1', function(item) { return item.source.y; })
          .attr('x2', function(item) { return item.target.x; })
          .attr('y2', function(item) { return item.target.y; });
      node.attr(
          'transform',
          function(
              item) { return 'translate(' + item.x + ',' + item.y + ')'; });
    });
  }

  topology.update_detail_list();
  topology.graph_isReady = true;
}
$(document).on('click', '#mobileNav a', function () {
    // Only collapse if the toggle button is visible (i.e. we're in mobile mode)
    if ($('.navbar-toggle:visible').length) {
      $('#mobileNav').collapse('hide');
    }
  });
