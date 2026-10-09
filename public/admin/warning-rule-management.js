/* 预警规则已并入告警中心各事件页的「规则配置」Tab。旧路由由 app.js 别名到 alert-parking。 */
(function () {
  'use strict';
  if (!window.app) return;
  window.app.register('warning-rule-management', function () {
    window.setTimeout(function () {
      window.__acPreferTab = 'rules';
      window.app.navigate('alert-parking');
    }, 0);
    return '';
  }, ['alert-parking']);
})();
