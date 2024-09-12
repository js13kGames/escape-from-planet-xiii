import { arrayPush } from "~aliasedFunctions";
import { arrayLast } from "~utils";

export type TreeProgramNode = any[] | number;

export interface TreeProgramBuilderContext {
    setReturn: (str: string) => void;
    // Returns the name of the var with the op result
    doOp: (node: TreeProgramNode) => string;
    setConstant: (value: string, type?: string) => string;

    pushToStackRaw: (stackName: string, value: string, type?: string) => void;
    pushToStack: (stackName: string, value: string, type?: string) => string;
    getStackTop: (stackName: string) => string;
    popStack: (stackName: string) => void;

    addCode: (str: string) => void;
};

type OpExecutionObject = { [k: number]: (...xargs: any[]) => void };

interface TreeProgramBuilderDefinition {
    getBuilder: (ctx: TreeProgramBuilderContext) => OpExecutionObject;
    setConstant: (value: string, type?: string) => string;
    addCode: (str: string) => void;
};

export const buildTreeProgram = (node: TreeProgramNode, def: TreeProgramBuilderDefinition) => {
    const { getBuilder, setConstant, addCode } = def;
    let builder: OpExecutionObject;

    const constStacks: { [k: string]: string[] } = {};

    const pushToStackRaw = (stackName: string, string: string) => {
        const stack = constStacks[stackName] ?? [];
        constStacks[stackName] = stack;
        arrayPush(stack, string);
    };

    const pushToStack = (stackName: string, value: string, type?: string) => {
        const c = setConstant(value, type);
        pushToStackRaw(stackName, c);
        return c;
    };

    const getStackTop = (stackName: string) => {
        return arrayLast(constStacks[stackName]);
    };

    const popStack = (stackName: string) => {
        constStacks[stackName].pop();
    };

    const returnConsts: string[] = [];

    const setReturn = (str: string) => {
        arrayPush(returnConsts, setConstant(str));
    };

    const doOpInternal = (id: number, ...rest: any[]) => {
        builder[id](...rest);
        return returnConsts.pop() as string;
    };

    const doOp = (node: TreeProgramNode) => doOpInternal(...(node as [any]));

    builder = getBuilder({
        setReturn,
        setConstant,
        addCode,
        doOp,
        pushToStackRaw,
        pushToStack,
        getStackTop,
        popStack,
    });

    doOp(node);
}

