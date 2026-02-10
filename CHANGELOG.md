# Changelog

All notable changes to [@bpmn-io/variable-resolver](https://github.com/bpmn-io/variable-resolver) are documented here. We use [semantic versioning](http://semver.org/) for releases.

## Unreleased

___Note:__ Yet to be released changes appear here._

## 1.4.1

* `FIX`: correctly handle falsy variable `atomicValue` ([#68](https://github.com/bpmn-io/variable-resolver/pull/68))
* `DEPS`: update to `@bpmn-io/lezer-feel@2.2.1`
* `DEPS`: update to `@lezer/common@1.5.1`

## 1.4.0

* `DEPS`: update to `@bpmn-io/extract-process-variables@2.0.0`
* `DEPS`: update to `@bpmn-io/lezer-feel@2.1.0`
* `DEPS`: update to `min-dash@5.0.0`

## 1.3.7

* `FIX`: adjust variable context to pass lezer-feel custom context tests ([#62](https://github.com/bpmn-io/variable-resolver/pull/62))
* `DEPS`: replace `lezer-feel` with `@bpmn-io/lezer-feel`

## 1.3.6

* `FIX`: always return an instance of variables context in `getResultContext` ([#58](https://github.com/bpmn-io/variable-resolver/pull/58))

## 1.3.5

* `FIX`: do not try to find unresolved variables of a broken expression ([#50](https://github.com/bpmn-io/variable-resolver/issues/50))

## 1.3.4

* `FIX`: preserve variables with same name but different scopes ([#56](https://github.com/bpmn-io/variable-resolver/pull/56))

## 1.3.3

* `FIX`: take scope into account when resolving variables ([#43](https://github.com/bpmn-io/variable-resolver/pull/43))
* `DEPS`: bump to `@bpmn-io/extract-process-variables@1.0.1`

## 1.3.2

* `FIX`: accept empty script expression without error ([#42](https://github.com/bpmn-io/variable-resolver/pull/42))

## 1.3.1

* `FIX`: parse script task result as FEEL context ([#41](https://github.com/bpmn-io/variable-resolver/pull/41))

## 1.3.0

_No feature changes._

* `DEPS`: bump to `@bpmn-io/extract-process-variables@1.0.0`

## 1.2.2

* `FIX`: prevent `Maximum call stack size exceeded` on variable merge ([#30](https://github.com/bpmn-io/variable-resolver/pull/30))

## 1.2.1

* `FIX`: prevent loops for cyclic variables ([#23](https://github.com/bpmn-io/variable-resolver/pull/23))

## 1.2.0

* `DEPS`: update to `lezer-feel@1`

## 1.1.0

* `FEAT`: filter variables depending on their order ([#19](https://github.com/bpmn-io/variable-resolver/pull/19))
* `FIX`: handle missing resultExpression value ([#20](https://github.com/bpmn-io/variable-resolver/pull/20))

## 1.0.1

* `FIX`: support empty variables in connector mappings ([#18](https://github.com/bpmn-io/variable-resolver/pull/18))

## 1.0.0

* `FEAT`: extract connector variables ([#14](https://github.com/bpmn-io/variable-resolver/pull/14))
* `FEAT`: handle multiple zeebe mappings ([#15](https://github.com/bpmn-io/variable-resolver/pull/15))
* `DEPS`: bump to `lezer-feel@0.17.1` ([#17](https://github.com/bpmn-io/variable-resolver/pull/17))

## 0.1.3

* `FIX`: don't show unknown types as `null` ([#12](https://github.com/bpmn-io/variable-resolver/pull/12))
* `FIX`: support install using `yarn@1` ([#13](https://github.com/bpmn-io/variable-resolver/pull/13))

## 0.1.2

* `FIX`: map FEEL variable types to editor format ([#9](https://github.com/bpmn-io/variable-resolver/pull/9))

## 0.1.1

* `DEPS`: update to `@bpmn-io/extract-process-variables@0.8.0`

## 0.1.0

* `FEAT`: allow external data providers to register ([#1](https://github.com/bpmn-io/variable-resolver/pull/1))
* `FEAT`: resolve types across I/O-mappings ([#2](https://github.com/bpmn-io/variable-resolver/issues/2))
