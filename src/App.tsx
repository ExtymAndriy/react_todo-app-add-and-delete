import React, { useEffect, useRef, useState } from 'react';
import { UserWarning } from './UserWarning';
import {
  getTodos,
  USER_ID,
  deleteTodo as deleteTodoAPI,
  addTodo,
} from './api/todos';
import { Footer } from './components/Footer';
import { ErrorNotification } from './components/ErrorNotification';
import { TodoItem } from './components/TodoItem';
import { Status } from './types/StatusType';
import { Todo } from './types/Todo';

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<Status>(Status.All);
  const [loading, setLoading] = useState(true);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (errorMessage) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const id = setTimeout(() => {
        setErrorMessage(null);
      }, 3000);

      timeoutRef.current = id;
    }
  }, [errorMessage]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isAdding]);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);

    getTodos()
      .then(data => {
        setTodos(data);
      })
      .catch(() => {
        setErrorMessage('Unable to load todos');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function filterTodos(status: Status) {
    if (status === Status.Active) {
      return todos.filter(todo => !todo.completed);
    } else if (status === Status.Completed) {
      return todos.filter(todo => todo.completed);
    }

    return todos;
  }

  const visibleTodos = filterTodos(filterStatus);

  const deleteTodo = (postId: number) => {
    // Clear any previous error message when starting a new deletion
    setErrorMessage(null);

    // Add loading state to the todo
    setTodos(currentTodos =>
      currentTodos.map(todo =>
        todo.id === postId ? { ...todo, loading: true } : todo,
      ),
    );

    deleteTodoAPI(postId)
      .then(() => {
        // Remove the todo on success
        setTodos(currentTodos =>
          currentTodos.filter(todo => todo.id !== postId),
        );
        // Focus input field after successful deletion
        inputRef.current?.focus();
      })
      .catch(() => {
        // Remove loading state and show error
        setTodos(currentTodos =>
          currentTodos.map(todo =>
            todo.id === postId ? { ...todo, loading: false } : todo,
          ),
        );
        setErrorMessage('Unable to delete a todo');
        // Focus input field even on error
        inputRef.current?.focus();
      });
  };

  const clearCompleted = () => {
    // Clear any previous error message when starting a new deletion
    setErrorMessage(null);

    const completedTodos = todos.filter(todo => todo.completed);

    // Add loading state to all completed todos
    setTodos(currentTodos =>
      currentTodos.map(todo =>
        completedTodos.some(completed => completed.id === todo.id)
          ? { ...todo, loading: true }
          : todo,
      ),
    );

    // Delete all completed todos in parallel
    Promise.allSettled(completedTodos.map(todo => deleteTodoAPI(todo.id)))
      .then(results => {
        // Track which deletions were successful
        const successfulDeletions = results
          .map((result, index) =>
            result.status === 'fulfilled' ? completedTodos[index].id : null,
          )
          .filter((id): id is number => id !== null);

        // Remove successfully deleted todos
        setTodos(currentTodos =>
          currentTodos.filter(todo => !successfulDeletions.includes(todo.id)),
        );

        // Show error if any deletion failed
        const hasErrors = results.some(result => result.status === 'rejected');

        if (hasErrors) {
          setErrorMessage('Unable to delete a todo');
        }

        // Focus input field after clearing completed todos
        inputRef.current?.focus();
      })
      .catch(() => {
        // Reset loading state on unexpected error
        setTodos(currentTodos =>
          currentTodos.map(todo =>
            completedTodos.some(completed => completed.id === todo.id)
              ? { ...todo, loading: false }
              : todo,
          ),
        );
        setErrorMessage('Unable to delete a todo');
      });
  };

  function handleCheckedId(id: number) {
    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  }

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(event.target.value);
  }

  function handleSubmitForm(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const trimmedTitle = inputValue.trim();

    if (trimmedTitle.length < 1) {
      setErrorMessage('Title should not be empty');

      return;
    }

    // Create temporary todo
    const newTempTodo: Todo = {
      id: 0,
      userId: USER_ID,
      title: trimmedTitle,
      completed: false,
      loading: true,
    };

    setTempTodo(newTempTodo);
    setIsAdding(true);

    const todo = {
      userId: USER_ID,
      title: trimmedTitle,
      completed: false,
    };

    addTodo(todo)
      .then(newTodo => {
        setTodos(currentTodos => [...currentTodos, newTodo as Todo]);
        setErrorMessage(null);
        setInputValue('');
        setTempTodo(null);
      })
      .catch(() => {
        setErrorMessage('Unable to add a todo');
        setTempTodo(null);
      })
      .finally(() => {
        setIsAdding(false);
      });
  }

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {!!todos.length && (
            <button
              type="button"
              className="todoapp__toggle-all active"
              data-cy="ToggleAllButton"
            />
          )}

          <form onSubmit={handleSubmitForm}>
            <input
              ref={inputRef}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={inputValue}
              onChange={handleInput}
              disabled={isAdding}
            />
          </form>
        </header>

        {!loading && todos.length > 0 && (
          <section className="todoapp__main" data-cy="TodoList">
            {visibleTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onDelete={deleteTodo}
                onToggleComplete={handleCheckedId}
              />
            ))}

            {tempTodo && (
              <TodoItem
                key={0}
                todo={tempTodo}
                onDelete={deleteTodo}
                onToggleComplete={handleCheckedId}
              />
            )}
          </section>
        )}

        {!loading && todos.length > 0 && (
          <Footer
            todos={todos}
            setFilterStatus={setFilterStatus}
            filterStatus={filterStatus}
            onClearCompleted={clearCompleted}
          />
        )}
      </div>

      <ErrorNotification
        errorMessage={errorMessage}
        onClose={() => setErrorMessage(null)}
      />
    </div>
  );
};
