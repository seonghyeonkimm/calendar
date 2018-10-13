import React, { Component } from 'react';
import moment from 'moment';
import axios from 'axios';

import CalController from 'components/CalController';
import Calendar from 'components/Calendar';
import CalModal from 'components/CalModal';
import Loading from 'components/Loading';
import Notification from 'components/Notification';
import { monthRange, weekRange } from 'utils/dateUtils';
import { getErrorMsg } from 'utils/errorUtils';

import CONSTANTS from './constants';

const { MOMENTS, NOTIFICATION } = CONSTANTS;
const fetchEvents = (startDate, endDate) => {
  const start_date = startDate.toISOString();
  const end_date = endDate.toISOString();
  return axios.get('/api/calendar', { params: { start_date, end_date }})
    .then(res => res.data)
};

class App extends Component {
  constructor(props) {
    super(props);
    this.onArrowClick = this.onArrowClick.bind(this);
    this.onTypeChange = this.onTypeChange.bind(this);
    this.onToggle = this.onToggle.bind(this);
    this.onTitleChange = this.onTitleChange.bind(this);
    this.onDateChange = this.onDateChange.bind(this);
    this.onDelete = this.onDelete.bind(this);
    this.onUpdate = this.onUpdate.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onDragStart = this.onDragStart.bind(this);
    this.onDrop = this.onDrop.bind(this);
    this.onToggleMsg = this.onToggleMsg.bind(this);
    const defaultDate = moment().startOf('month');
    const { start_date, end_date, items } = monthRange(defaultDate);
    this.state = {
      isOpen: false,
      isLoading: false,
      type: 'month',
      date: defaultDate,
      start_date,
      end_date,
      range: items,
      calendar: [],
      event: {
        _id: '',
        title: '',
        start_date: defaultDate,
        end_date: moment(defaultDate).add(1, 'hours'),
      },
      message: {
        isOpen: false,
        message: '',
        type: 'danger',
      },
    };
  }

  componentDidMount() {
    const { start_date, end_date } = this.state;
    this.setLoading();
    fetchEvents(start_date, end_date)
    .then((result) => {
      this.setLoading();
      this.setState({
        calendar: result,
      });
    })
  }

  componentDidUpdate(prevProps, prevState) {
    const prevStartDate = prevState.start_date;
    const prevEndDate = prevState.end_date;
    const { start_date, end_date } = this.state;
    if (!prevStartDate.isSame(start_date) || !prevEndDate.isSame(end_date)) {
      this.setLoading();
      fetchEvents(start_date, end_date)
      .then((result) => {
        this.setLoading();
        this.setState({
          calendar: result,
        });
      });
    }
  }

  componentWillUnmount() {
    if (this.closeMsg) {
      clearTimeout(this.closeMsg);
    }
  }

  onArrowClick(e) {
    e.stopPropagation();
    const { name } = e.currentTarget;
    const { type, date } = this.state;
    const newDate = (
      (name === 'next')
        ? moment(date).add(1, MOMENTS[type])
        : moment(date).subtract(1, MOMENTS[type])
    );
    this.updateCalendar(type, newDate);
  }

  onTypeChange(e) {
    e.stopPropagation();
    const { name } = e.currentTarget;
    const { type } = this.state;
    if (name === type) {
      return;
    }

    const date = (
      (name === 'month')
        ? moment().startOf('month')
        : moment().startOf('week')
    );
    this.updateCalendar(name, date, { type: name });
  }

  onToggle(e, props = {}) {
    e.stopPropagation();
    const { type, dateObj, hour } = props;
    const { isOpen, event } = this.state;

    if (isOpen) {
      this.setState({
        isOpen: !isOpen,
        event: {
          ...event,
          _id: '',
          title: '',
        }
      });
      return;
    }

    const newEvent = {}
    if (type === 'month') {
      const currentHour = moment().hour();
      const startDate = moment(dateObj.moment).hours(currentHour);
      newEvent.start_date = startDate;
      newEvent.end_date = moment(startDate).add(1, 'hours');
    }

    if (type === 'week') {
      const startDate = moment(`${dateObj.year}-${dateObj.month}-${dateObj.date} ${hour}:00`, 'YYYY-M-D hh:mm');
      newEvent.start_date = startDate;
      newEvent.end_date = moment(startDate).add(1, 'hours');
    }

    if (type === 'event') {
      const { start_date, end_date, title, _id } = dateObj;
      newEvent._id = _id;
      newEvent.title = title;
      newEvent.start_date = moment(start_date);
      newEvent.end_date = moment(end_date);
    }

    this.setState({
      isOpen: !isOpen,
      event: {
        ...event,
        ...newEvent,
      },
    });
  }

  onTitleChange(e) {
    e.preventDefault();
    const { value } = e.currentTarget;
    const { event } = this.state;
    this.setState({
      event: {
        ...event,
        title: value,
      },
    });
  }

  onDateChange(date) {
    const { event } = this.state;
    this.setState({
      event: {
        ...event,
        start_date: date,
        end_date: moment(date).add(1, 'hours'),
      },
    });
  }

  onUpdate(e) {
    e.preventDefault();
    const { event, calendar } = this.state;
    const { _id, title, start_date, end_date } = event;
    if(!_id || !title || !start_date || !end_date) {
      return;
    }

    const putData = {
      title,
      start_date: start_date.toISOString(),
      end_date: end_date.toISOString(),
    };
    this.setLoading();
    axios.put(`/api/calendar/${_id}`, putData)
      .then(() => {
        this.setLoading();
        const newCalendar = [ ...calendar ].filter(item => item._id !== _id);
        putData._id = _id;
        newCalendar.push(putData);
        this.setState({
          calendar: newCalendar,
          isOpen: false,
          event: {
            ...event,
            _id: '',
            title: '',
          },
        });
        this.notify({
          type: 'success',
          message: NOTIFICATION.update,
        });
      }, (error) => {
        this.setLoading();
        const message = getErrorMsg(error)
        this.notify({ message });
      });
  }

  onDelete(e) {
    e.preventDefault();
    const { event, calendar } = this.state;
    const { _id } = event;
    if (!_id) {
      return;
    }

    this.setLoading();
    axios.delete(`/api/calendar/${_id}`)
    .then(() => {
      this.setLoading();
      const newCalendar = [ ...calendar ].filter(item => item._id !== _id);
      this.setState({
        calendar: newCalendar,
        isOpen: false,
        event: {
          ...event,
          _id: '',
          title: '',
        }
      });

      this.notify({
        type: 'success',
        message: NOTIFICATION.delete,
      });
    }, (error) => {
      this.setLoading();
      const message = getErrorMsg(error);
      this.notify({ message });
    })
  }

  onSubmit(e) {
    e.preventDefault();
    const { event, calendar } = this.state;
    const { title, start_date, end_date } = event;
    const postData = {
      title,
      start_date: start_date.toISOString(),
      end_date: end_date.toISOString(),
    };
    this.setLoading();
    axios.post('/api/calendar', postData)
    .then((res) => {
      this.setLoading();
      const newCalendar = [...calendar];
      newCalendar.push({
        _id: res.data._id,
        title,
        start_date,
        end_date,
      });
      this.setState({
        calendar: newCalendar,
        isOpen: false,
        event: {
          ...event,
          _id: '',
          title: '',
        }
      });
      this.notify({
        type: 'success',
        message: NOTIFICATION.create,
      });
    }, (error) => {
      this.setLoading();
      const message = getErrorMsg(error);
      this.notify({ message });
    });
  }

  onDragStart(e, props) {
    const { event } = props;
    e.dataTransfer.setData('event_data', JSON.stringify(event));
  }

  onDrop(e, props) {
    const { calendar } = this.state;
    const { type, hour, dateObj } = props;
    const { year, month, date } = dateObj;
    const event = JSON.parse(e.dataTransfer.getData('event_data'));
    const { title, _id, start_date } = event;

    let newStartDate;
    let newEndDate;
    if (type === 'week') {
      newStartDate = moment(`${year}-${month}-${date} ${hour}:00`, 'YYYY-M-D hh:mm');
      newEndDate = moment(newStartDate).add(1, 'hours');
    }

    if (type === 'month') {
      newStartDate = (
        moment(start_date)
          .year(year)
          .month(month - 1)
          .date(date)
      );
      newEndDate = moment(newStartDate).add(1, 'hours');
    }

    const putData = {
      title,
      start_date: newStartDate.toISOString(),
      end_date: newEndDate.toISOString(),
    };
    this.setLoading();
    axios.put(`/api/calendar/${_id}`, putData)
      .then(() => {
        this.setLoading();
        const newCalendar = [...calendar].filter(item => item._id !== _id);
        putData._id = _id
        newCalendar.push(putData);
        this.setState({ calendar: newCalendar });
        this.notify({
          type: 'success',
          message: NOTIFICATION.update,
        });
      }, (error) => {
        this.setLoading();
        const message = getErrorMsg(error);
        this.notify({ message });
      });
  }

  onToggleMsg(e, props) {
    const { message } = this.state;
    const { isOpen } = message;
    this.setState({
      message: {
        ...message,
        isOpen: !isOpen,
      },
    });
  }

  setLoading() {
    const { isLoading } = this.state;
    this.setState({
      isLoading: !isLoading,
    });
  }

  updateCalendar(type, date, nextState) {
    const { start_date, end_date, items } = (
      (type === 'month')
        ? monthRange(date)
        : weekRange(date)
    );
    this.setState({
      date,
      start_date,
      end_date,
      range: items,
      ...nextState
    });
  }

  notify(data) {
    const { message } = this.state;
    this.setState({
      message: {
        ...message,
        isOpen: true,
        type: data.type,
        message: data.message,
      },
    });

    this.closeMsg = setTimeout(this.onToggleMsg, 1000);
  }

  render() {
    const {
      type,
      date,
      range,
      isOpen,
      event,
      calendar,
      isLoading,
      message,
    } = this.state;
    return (
      <section className="container">
        <CalController
          type={type}
          currentDate={date}
          onArrowClick={this.onArrowClick}
          onTypeChange={this.onTypeChange}
        />
        <Calendar
          type={type}
          range={range}
          currentDate={date}
          onToggle={this.onToggle}
          onDragStart={this.onDragStart}
          onDrop={this.onDrop}
          data={calendar}
        />
        <CalModal
          isOpen={isOpen}
          isLoading={isLoading}
          onToggle={this.onToggle}
          onChange={this.onTitleChange}
          onDateChange={this.onDateChange}
          onUpdate={this.onUpdate}
          onDelete={this.onDelete}
          onSubmit={this.onSubmit}
          event={event}
        />
        <Loading isOpen={isLoading} />
        <Notification onToggle={this.onToggleMsg} {...message} />
      </section>
    );
  }
}

export default App;
